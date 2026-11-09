"""Phase 4 backend support: real notifications, feed pages, messaging sync, documents."""
import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase

from accounts.models import User
from messaging.models import Conversation, Message
from posts.models import Post
from startups.models import Investment, Startup

from .models import Notification

PW = 'c0rrect-Horse-battery'


class Base(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user('owner@example.com', PW, first_name='Olive')
        cls.fan = User.objects.create_user('fan@example.com', PW, first_name='Fay')
        cls.startup = Startup.objects.create(slug='acme', name='Acme', owner=cls.owner, goal=1000, status='open')

    def as_user(self, user):
        self.client.force_authenticate(user)

    def inbox(self, user):
        return list(Notification.objects.filter(recipient=user).values_list('text', flat=True))


class EventNotificationTests(Base):
    """FE-03: notifications come from real events, never for your own actions."""

    def test_comment_notifies_owner_but_not_self(self):
        self.as_user(self.fan)
        self.client.post('/api/comments/', {'startup': 'acme', 'text': 'Love it'})
        self.assertEqual(len(self.inbox(self.owner)), 1)
        self.assertIn('Fay commented on Acme', self.inbox(self.owner)[0])
        self.as_user(self.owner)
        self.client.post('/api/comments/', {'startup': 'acme', 'text': 'Thanks'})
        self.assertEqual(len(self.inbox(self.owner)), 1)

    def test_like_notifies_author_on_like_only(self):
        post = Post.objects.create(title='Launch', author=self.owner, startup=self.startup)
        self.as_user(self.fan)
        self.client.post(f'/api/posts/{post.id}/toggle_like/')  # like
        self.client.post(f'/api/posts/{post.id}/toggle_like/')  # unlike
        self.assertEqual(len(self.inbox(self.owner)), 1)

    def test_follow_notifies_once(self):
        self.as_user(self.fan)
        self.client.post('/api/startups/acme/follow/')
        self.client.post('/api/startups/acme/follow/')
        self.assertEqual(len(self.inbox(self.owner)), 1)

    def test_message_notifies_the_other_participant(self):
        convo = Conversation.objects.create(startup=self.startup, initiator=self.fan)
        self.as_user(self.fan)
        self.client.post('/api/messages/', {'conversation': convo.id, 'text': 'Hello'})
        self.as_user(self.owner)
        self.client.post('/api/messages/', {'conversation': convo.id, 'text': 'Hi back'})
        self.assertEqual(len(self.inbox(self.owner)), 1)
        self.assertEqual(len(self.inbox(self.fan)), 1)

    def test_read_all(self):
        Notification.objects.create(recipient=self.owner, text='a')
        Notification.objects.create(recipient=self.owner, text='b')
        Notification.objects.create(recipient=self.fan, text='not yours')
        self.as_user(self.owner)
        self.assertEqual(self.client.post('/api/notifications/read_all/').data['marked_read'], 2)
        self.assertFalse(Notification.objects.get(recipient=self.fan).read)


class MessagingSyncTests(Base):
    """FE-08."""

    def test_unread_counts_and_mark_read(self):
        convo = Conversation.objects.create(startup=self.startup, initiator=self.fan)
        Message.objects.create(conversation=convo, sender=self.fan, text='1')
        Message.objects.create(conversation=convo, sender=self.fan, text='2')
        Message.objects.create(conversation=convo, sender=self.owner, text='mine')
        self.as_user(self.owner)
        self.assertEqual(self.client.get('/api/conversations/unread/').data, {'total': 2, 'conversations': 1})
        self.assertEqual(self.client.post(f'/api/conversations/{convo.id}/read/').data['marked_read'], 2)
        self.assertEqual(self.client.get('/api/conversations/unread/').data['total'], 0)
        self.assertFalse(Message.objects.get(text='mine').read)  # own messages untouched

    def test_strangers_cannot_mark_read(self):
        convo = Conversation.objects.create(startup=self.startup, initiator=self.fan)
        stranger = User.objects.create_user('x@example.com', PW)
        self.as_user(stranger)
        self.assertEqual(self.client.post(f'/api/conversations/{convo.id}/read/').status_code, 404)


class FeedPaginationTests(Base):
    """FE-05."""

    def test_pages_are_stable_and_complete(self):
        for i in range(23):
            Post.objects.create(title=f'p{i}', author=self.owner)
        seen = []
        url = '/api/posts/'
        while url:
            res = self.client.get(url)
            self.assertEqual(res.status_code, 200)
            self.assertLessEqual(len(res.data['results']), 10)
            seen += [p['id'] for p in res.data['results']]
            url = res.data['next']
        self.assertEqual(len(seen), 23)
        self.assertEqual(len(set(seen)), 23)

    def test_gallery_filter(self):
        Post.objects.create(title='text only', startup=self.startup, author=self.owner)
        Post.objects.create(title='pic', startup=self.startup, author=self.owner, media='post_media/x.png')
        res = self.client.get('/api/posts/?startup=acme&has_media=1')
        self.assertEqual([p['title'] for p in res.data['results']], ['pic'])


class StartupDocumentAndDeleteTests(Base):
    """FE-09 / FE-10."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._media = tempfile.mkdtemp()
        cls._override = override_settings(MEDIA_ROOT=cls._media)
        cls._override.enable()

    @classmethod
    def tearDownClass(cls):
        cls._override.disable()
        shutil.rmtree(cls._media, ignore_errors=True)
        super().tearDownClass()

    def pdf(self):
        return SimpleUploadedFile('Pitch Deck.pdf', b'%PDF-1.7\n' + b'0' * 2048, content_type='application/pdf')

    def test_owner_uploads_and_removes_document(self):
        self.as_user(self.owner)
        res = self.client.post('/api/startups/acme/documents/', {'file': self.pdf()}, format='multipart')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['name'], 'Pitch Deck.pdf')
        self.assertEqual(res.data['size'], '2.0 KB')
        self.assertTrue(res.data['file'].startswith('http'))
        detail = self.client.get('/api/startups/acme/').data
        self.assertEqual(len(detail['docs']), 1)
        res = self.client.delete(f'/api/startups/acme/documents/{res.data["id"]}/')
        self.assertEqual(res.status_code, 204)

    def test_others_cannot_upload_and_html_is_rejected(self):
        self.as_user(self.fan)
        res = self.client.post('/api/startups/acme/documents/', {'file': self.pdf()}, format='multipart')
        self.assertEqual(res.status_code, 403)
        self.as_user(self.owner)
        evil = SimpleUploadedFile('deck.html', b'<script>x</script>', content_type='text/html')
        self.assertEqual(self.client.post('/api/startups/acme/documents/', {'file': evil}, format='multipart').status_code, 400)

    def test_delete_blocked_when_investments_were_accepted(self):
        Investment.objects.create(startup=self.startup, investor=self.fan, amount=500, status='accepted')
        self.as_user(self.owner)
        res = self.client.delete('/api/startups/acme/')
        self.assertEqual(res.status_code, 409)
        self.assertIn('accepted investments', res.data['detail'])
        Investment.objects.update(status='rejected')
        self.assertEqual(self.client.delete('/api/startups/acme/').status_code, 204)
        self.assertFalse(Startup.objects.filter(pk='acme').exists())
