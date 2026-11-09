from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient, APITestCase

from accounts.models import User
from startups.models import Startup
from .models import Conversation, Message


class MessagingTests(APITestCase):
    def setUp(self):
        self.owner = self.make_user('owner@example.com', 'Owner')
        self.visitor = self.make_user('visitor@example.com', 'Visitor')
        self.outsider = self.make_user('outsider@example.com', 'Outsider')
        self.startup = Startup.objects.create(name='Test Startup', owner=self.owner)
        self.owner_client = self.client_for(self.owner)
        self.visitor_client = self.client_for(self.visitor)
        self.outsider_client = self.client_for(self.outsider)

    @staticmethod
    def make_user(email, name):
        user = User(email=email, first_name=name)
        user.set_password('test-password-123')
        user.save()
        return user

    @staticmethod
    def client_for(user):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Token {Token.objects.create(user=user).key}')
        return client

    def test_two_accounts_exchange_messages_and_mark_received_as_read(self):
        created = self.visitor_client.post('/api/conversations/', {'startup': self.startup.slug})
        self.assertEqual(created.status_code, 201)
        conversation_id = created.data['id']
        self.assertEqual(self.visitor_client.post('/api/conversations/', {'startup': self.startup.slug}).status_code, 200)
        self.assertEqual(Conversation.objects.count(), 1)

        sent = self.visitor_client.post('/api/messages/', {'conversation': conversation_id, 'text': 'Hello'})
        self.assertEqual(sent.status_code, 201)
        self.assertEqual(sent.data['sender'], self.visitor.id)
        owner_inbox = self.owner_client.get('/api/conversations/')
        self.assertEqual(owner_inbox.status_code, 200)
        self.assertEqual(owner_inbox.data[0]['messages'][0]['text'], 'Hello')

        read = self.owner_client.post(f'/api/conversations/{conversation_id}/read/')
        self.assertEqual(read.status_code, 204)
        self.assertTrue(Message.objects.get(pk=sent.data['id']).read)

        reply = self.owner_client.post('/api/messages/', {'conversation': conversation_id, 'text': 'Hi back'})
        self.assertEqual(reply.status_code, 201)
        visitor_inbox = self.visitor_client.get('/api/conversations/')
        self.assertEqual([m['text'] for m in visitor_inbox.data[0]['messages']], ['Hello', 'Hi back'])

    def test_unrelated_account_cannot_read_or_send(self):
        conversation = Conversation.objects.create(startup=self.startup, initiator=self.visitor)
        message = Message.objects.create(conversation=conversation, sender=self.visitor, text='Private')
        self.assertEqual(self.outsider_client.get('/api/conversations/').data, [])
        self.assertEqual(self.outsider_client.get(f'/api/conversations/{conversation.id}/').status_code, 404)
        self.assertEqual(self.outsider_client.get(f'/api/messages/{message.id}/').status_code, 404)
        self.assertEqual(self.outsider_client.post('/api/messages/', {'conversation': conversation.id, 'text': 'Intrusion'}).status_code, 400)
        self.assertEqual(self.outsider_client.post(f'/api/conversations/{conversation.id}/read/').status_code, 404)
        self.assertEqual(Message.objects.count(), 1)

    def test_messages_cannot_be_edited_or_deleted_and_self_conversations_are_rejected(self):
        conversation = Conversation.objects.create(startup=self.startup, initiator=self.visitor)
        message = Message.objects.create(conversation=conversation, sender=self.visitor, text='Original')
        self.assertEqual(self.owner_client.patch(f'/api/messages/{message.id}/', {'text': 'Changed'}).status_code, 405)
        self.assertEqual(self.owner_client.delete(f'/api/messages/{message.id}/').status_code, 405)
        self.assertEqual(self.owner_client.delete(f'/api/conversations/{conversation.id}/').status_code, 405)
        self.assertEqual(self.owner_client.post('/api/conversations/', {'startup': self.startup.slug}).status_code, 400)
        self.assertEqual(Message.objects.get(pk=message.id).text, 'Original')
