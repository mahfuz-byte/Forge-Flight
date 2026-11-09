"""Object-level permission tests across apps (AUTH-10)."""
from rest_framework.test import APITestCase

from accounts.models import Role, User
from messaging.models import Conversation, Message
from posts.models import Post
from startups.models import Application, Investment, Startup, StartupComment

PW = 'c0rrect-Horse-battery'


class OwnershipTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user('owner@example.com', PW, first_name='Owner')
        cls.other = User.objects.create_user('other@example.com', PW, first_name='Other')
        cls.mod = User.objects.create_user('mod@example.com', PW, first_name='Mod', role=Role.MODERATOR)
        cls.startup = Startup.objects.create(slug='acme', name='Acme', owner=cls.owner)
        cls.post = Post.objects.create(title='Launch', startup=cls.startup, author=cls.owner)
        cls.comment = StartupComment.objects.create(startup=cls.startup, author=cls.owner, text='hello')

    def as_user(self, user):
        self.client.force_authenticate(user)

    # -- startups
    def test_only_owner_edits_startup(self):
        self.as_user(self.other)
        self.assertEqual(self.client.patch('/api/startups/acme/', {'name': 'Hacked'}).status_code, 403)
        self.assertEqual(self.client.delete('/api/startups/acme/').status_code, 403)
        self.as_user(self.owner)
        self.assertEqual(self.client.patch('/api/startups/acme/', {'name': 'Acme 2'}).status_code, 200)

    def test_any_user_can_still_follow_and_save(self):
        self.as_user(self.other)
        self.assertEqual(self.client.post('/api/startups/acme/follow/').status_code, 204)
        self.assertEqual(self.client.post('/api/startups/acme/save/').status_code, 204)

    # -- posts
    def test_other_users_cannot_edit_or_delete_posts(self):
        self.as_user(self.other)
        self.assertEqual(self.client.patch(f'/api/posts/{self.post.id}/', {'title': 'x'}).status_code, 403)
        self.assertEqual(self.client.delete(f'/api/posts/{self.post.id}/').status_code, 403)
        self.assertTrue(Post.objects.filter(pk=self.post.pk).exists())

    def test_cannot_post_as_someone_elses_startup(self):
        self.as_user(self.other)
        res = self.client.post('/api/posts/', {'title': 'Fake', 'startup': 'acme'})
        self.assertEqual(res.status_code, 400)
        res = self.client.post('/api/posts/', {'title': 'Mine'})
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['author'], self.other.id)

    def test_pinning_is_reserved_for_startup_owner(self):
        own = Post.objects.create(title='Mine', startup=self.startup, author=self.other)
        self.as_user(self.other)  # author of the post, but not owner of the startup
        self.assertEqual(self.client.patch(f'/api/posts/{own.id}/', {'pinned': True}).status_code, 400)
        self.as_user(self.owner)
        self.assertEqual(self.client.patch(f'/api/posts/{self.post.id}/', {'pinned': True}).status_code, 200)

    def test_post_cannot_be_moved_to_another_startup(self):
        Startup.objects.create(slug='other-co', name='Other', owner=self.owner)
        self.as_user(self.owner)
        self.client.patch(f'/api/posts/{self.post.id}/', {'startup': 'other-co'})
        self.post.refresh_from_db()
        self.assertEqual(self.post.startup_id, 'acme')

    def test_moderator_can_remove_posts(self):
        self.as_user(self.mod)
        self.assertEqual(self.client.delete(f'/api/posts/{self.post.id}/').status_code, 204)

    # -- comments
    def test_comment_permissions(self):
        url = f'/api/comments/{self.comment.id}/'
        self.as_user(self.other)
        self.assertEqual(self.client.patch(url, {'text': 'x'}).status_code, 403)
        self.assertEqual(self.client.delete(url).status_code, 403)
        self.as_user(self.mod)
        self.assertEqual(self.client.delete(url).status_code, 204)

    # -- applications & investments
    def test_applications_visible_only_to_applicant_and_startup_owner(self):
        app = Application.objects.create(startup=self.startup, applicant=self.other, role='Dev')
        stranger = User.objects.create_user('stranger@example.com', PW)
        self.as_user(stranger)
        self.assertEqual(self.client.get('/api/applications/').data, [])
        self.assertEqual(self.client.patch(f'/api/applications/{app.id}/', {'role': 'x'}).status_code, 404)
        self.as_user(self.owner)
        self.assertEqual(len(self.client.get('/api/applications/').data), 1)
        self.assertEqual(self.client.delete(f'/api/applications/{app.id}/').status_code, 403)
        self.as_user(self.other)
        self.assertEqual(self.client.patch(f'/api/applications/{app.id}/', {'role': 'Lead'}).status_code, 200)

    def test_investments_visible_only_to_investor_owner_and_finance(self):
        inv = Investment.objects.create(startup=self.startup, investor=self.other, amount=500)
        stranger = User.objects.create_user('stranger@example.com', PW)
        finance = User.objects.create_user('fin@example.com', PW, role=Role.FINANCE_ADMIN)
        self.as_user(stranger)
        self.assertEqual(self.client.get('/api/investments/').data, [])
        self.assertEqual(self.client.delete(f'/api/investments/{inv.id}/').status_code, 404)
        self.as_user(finance)
        self.assertEqual(len(self.client.get('/api/investments/').data), 1)
        self.as_user(self.owner)
        self.assertEqual(self.client.patch(f'/api/investments/{inv.id}/', {'amount': 1}).status_code, 403)
        self.as_user(self.other)
        self.assertEqual(self.client.delete(f'/api/investments/{inv.id}/').status_code, 204)

    # -- messaging
    def test_messaging_permissions(self):
        convo = Conversation.objects.create(startup=self.startup, initiator=self.other)
        msg = Message.objects.create(conversation=convo, sender=self.other, text='hi')
        stranger = User.objects.create_user('stranger@example.com', PW)

        self.as_user(stranger)
        res = self.client.post('/api/messages/', {'conversation': convo.id, 'text': 'spam'})
        self.assertEqual(res.status_code, 400)
        self.assertEqual(self.client.get('/api/messages/').data, [])

        self.as_user(self.owner)  # recipient
        self.assertEqual(self.client.patch(f'/api/messages/{msg.id}/', {'text': 'edited'}).status_code, 403)
        self.assertEqual(self.client.delete(f'/api/messages/{msg.id}/').status_code, 403)
        self.assertEqual(self.client.patch(f'/api/messages/{msg.id}/', {'read': True}).status_code, 200)

        self.as_user(self.other)  # sender
        self.assertEqual(self.client.patch(f'/api/messages/{msg.id}/', {'text': 'edited'}).status_code, 200)
        self.assertEqual(self.client.delete(f'/api/conversations/{convo.id}/').status_code, 405)
