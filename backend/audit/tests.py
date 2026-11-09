"""Audit logging tests (SEC-10) and admin authorization in Django admin (SEC-09)."""
from django.contrib.admin.sites import site
from django.core.cache import cache
from django.test import RequestFactory, TestCase
from rest_framework.test import APITestCase

from accounts.models import Role, User
from posts.models import Post
from startups.models import Startup

from .models import AuditLog

PW = 'c0rrect-Horse-battery'


def actions():
    return list(AuditLog.objects.order_by('id').values_list('action', flat=True))


class AuthAuditTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user('a@example.com', PW, first_name='A')
        cache.clear()  # reset login throttles between tests

    def test_login_success_failure_and_logout_are_logged(self):
        self.client.post('/api/auth/login/', {'email': 'a@example.com', 'password': 'wrong-password'})
        self.client.post('/api/auth/login/', {'email': 'A@Example.com', 'password': PW})
        self.client.post('/api/auth/logout/')

        failed = AuditLog.objects.get(action='auth.login_failed')
        self.assertEqual(failed.data['email'], 'a@example.com')
        self.assertIsNone(failed.actor)
        self.assertEqual(failed.ip, '127.0.0.1')

        login = AuditLog.objects.get(action='auth.login')
        self.assertEqual(login.actor, self.user)
        self.assertEqual(login.data['method'], 'password')
        self.assertTrue(AuditLog.objects.filter(action='auth.logout', actor=self.user).exists())

    def test_password_is_never_recorded(self):
        self.client.post('/api/auth/login/', {'email': 'a@example.com', 'password': 'wrong-password'})
        self.client.force_authenticate(self.user)
        self.client.post('/api/auth/password/', {'current_password': PW, 'new_password': 'n3w-Password-xyz'})
        self.assertTrue(AuditLog.objects.filter(action='auth.password_changed').exists())
        dump = str(list(AuditLog.objects.values()))
        self.assertNotIn('wrong-password', dump)
        self.assertNotIn('n3w-Password-xyz', dump)

    def test_registration_logs_user_created(self):
        self.client.post('/api/auth/register/', {
            'email': 'new@example.com', 'password': PW, 'first_name': 'N', 'last_name': 'U',
        })
        entry = AuditLog.objects.get(action='user.created', target_id=str(User.objects.get(email='new@example.com').pk))
        self.assertEqual(entry.actor.email, 'new@example.com')


class UserChangeAuditTests(TestCase):
    def test_role_and_status_changes_are_logged(self):
        user = User.objects.create_user('b@example.com', PW)
        user.role = Role.MODERATOR
        user.save()
        user.is_active = False
        user.save()
        entry = AuditLog.objects.get(action='user.privileges_changed')
        self.assertEqual(entry.data['changes']['role'], ['user', 'moderator'])
        self.assertTrue(AuditLog.objects.filter(action='user.deactivated', target_id=str(user.pk)).exists())

    def test_unwatched_saves_are_not_logged(self):
        user = User.objects.create_user('c@example.com', PW)
        before = AuditLog.objects.count()
        user.bio = 'hello'
        user.save()
        user.save(update_fields=['last_login'])
        self.assertEqual(AuditLog.objects.count(), before)

    def test_entries_are_immutable(self):
        entry = AuditLog.objects.create(action='test.action')
        entry.action = 'changed'
        with self.assertRaises(ValueError):
            entry.save()
        with self.assertRaises(ValueError):
            entry.delete()


class StaffActionAuditTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user('owner@example.com', PW)
        cls.mod = User.objects.create_user('mod@example.com', PW, role=Role.MODERATOR)
        cls.startup = Startup.objects.create(slug='acme', name='Acme', owner=cls.owner)

    def test_owner_deleting_own_post_is_not_a_staff_action(self):
        post = Post.objects.create(title='Mine', author=self.owner)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.delete(f'/api/posts/{post.id}/').status_code, 204)
        self.assertFalse(AuditLog.objects.filter(action__startswith='post.staff').exists())

    def test_moderator_removing_a_post_is_logged(self):
        post = Post.objects.create(title='Spam', author=self.owner)
        self.client.force_authenticate(self.mod)
        self.assertEqual(self.client.delete(f'/api/posts/{post.id}/').status_code, 204)
        entry = AuditLog.objects.get(action='post.staff_delete')
        self.assertEqual(entry.actor, self.mod)
        self.assertEqual(entry.target_id, str(post.id))
        self.assertEqual(entry.target_repr, 'Spam')
        self.assertEqual(entry.data['owner_id'], self.owner.id)

    def test_investment_lifecycle_is_logged(self):
        investor = User.objects.create_user('inv@example.com', PW)
        self.client.force_authenticate(investor)
        res = self.client.post('/api/investments/', {'startup': 'acme', 'amount': 500})
        self.assertEqual(res.status_code, 201, res.data)
        self.client.patch(f'/api/investments/{res.data["id"]}/', {'amount': 750})
        self.client.delete(f'/api/investments/{res.data["id"]}/')
        self.assertEqual(
            [a for a in actions() if a.startswith('investment.')],
            ['investment.create', 'investment.update', 'investment.delete'],
        )


class DjangoAdminAuthorizationTests(TestCase):
    """SEC-09: staff below super admin can't grant themselves or others authority."""

    def setUp(self):
        self.admin_user = User.objects.create_user('adm@example.com', PW, role=Role.ADMIN, is_staff=True)
        self.super_user = User.objects.create_user('sup@example.com', PW, role=Role.SUPER_ADMIN, is_staff=True)
        self.plain = User.objects.create_user('plain@example.com', PW)
        self.model_admin = site._registry[User]
        self.factory = RequestFactory()

    def request_as(self, user):
        request = self.factory.get('/admin/')
        request.user = user
        return request

    def test_only_super_admin_can_edit_privilege_fields(self):
        ro = self.model_admin.get_readonly_fields(self.request_as(self.admin_user), self.plain)
        self.assertIn('role', ro)
        self.assertIn('is_superuser', ro)
        ro = self.model_admin.get_readonly_fields(self.request_as(self.super_user), self.plain)
        self.assertNotIn('role', ro)

    def test_admin_cannot_edit_or_delete_higher_accounts(self):
        request = self.request_as(self.admin_user)
        self.assertFalse(self.model_admin.has_change_permission(request, self.super_user))
        self.assertFalse(self.model_admin.has_delete_permission(request, self.super_user))
        self.assertFalse(self.model_admin.has_delete_permission(request, self.admin_user))  # not themselves

    def test_audit_log_is_hidden_from_non_super_admins_and_read_only(self):
        from .models import AuditLog as Model
        audit_admin = site._registry[Model]
        self.assertFalse(audit_admin.has_view_permission(self.request_as(self.admin_user)))
        request = self.request_as(self.super_user)
        self.assertTrue(audit_admin.has_view_permission(request))
        self.assertFalse(audit_admin.has_add_permission(request))
        self.assertFalse(audit_admin.has_change_permission(request))
        self.assertFalse(audit_admin.has_delete_permission(request))

    def test_django_admin_actions_are_mirrored(self):
        from django.contrib.admin.models import CHANGE, LogEntry
        from django.contrib.contenttypes.models import ContentType
        LogEntry.objects.create(
            user=self.super_user, content_type=ContentType.objects.get_for_model(User),
            object_id=str(self.plain.pk), object_repr=str(self.plain), action_flag=CHANGE,
            change_message='[]',
        )
        entry = AuditLog.objects.get(action='admin.change')
        self.assertEqual(entry.actor, self.super_user)
        self.assertEqual(entry.target_type, 'accounts.user')
        self.assertEqual(entry.target_id, str(self.plain.pk))
