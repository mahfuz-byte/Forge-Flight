from unittest import mock

from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.test import override_settings
from rest_framework.test import APIClient, APITestCase

from .google import GoogleAuthError, GoogleIdentity
from .models import Role, SocialAccount, User

STRONG = 'c0rrect-Horse-battery'

NO_THROTTLE = {
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticatedOrReadOnly'],
    'DEFAULT_THROTTLE_RATES': {'auth': '1000/min'},
}


def google_identity(**overrides):
    data = dict(sub='google-sub-1', email='new.person@gmail.com', email_verified=True,
                given_name='New', family_name='Person')
    data.update(overrides)
    return GoogleIdentity(**data)


@override_settings(REST_FRAMEWORK=NO_THROTTLE)
class AuthTestCase(APITestCase):
    def setUp(self):
        cache.clear()


class RegistrationTests(AuthTestCase):
    def test_register_normalizes_email_and_starts_session(self):
        res = self.client.post('/api/auth/register/', {
            'first_name': 'Jo', 'last_name': 'Wren', 'email': '  Jo.Wren@Example.COM ', 'password': STRONG,
        })
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['email'], 'jo.wren@example.com')
        self.assertEqual(res.data['role'], 'user')
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 200)

    def test_duplicate_email_in_different_case_is_rejected(self):
        User.objects.create_user('jo@example.com', STRONG)
        res = self.client.post('/api/auth/register/', {'email': 'JO@example.com', 'password': STRONG})
        self.assertEqual(res.status_code, 400)
        self.assertIn('email', res.data)

    def test_case_insensitive_uniqueness_is_enforced_by_the_database(self):
        User.objects.create_user('jo@example.com', STRONG)
        with self.assertRaises(IntegrityError), transaction.atomic():
            # Bypass save() normalization to prove the DB constraint itself holds.
            User.objects.bulk_create([User(email='JO@EXAMPLE.COM', slug='other')])

    def test_weak_passwords_are_rejected(self):
        for weak in ['short1', 'password123', '1234567890123', 'jowren-example']:
            res = self.client.post('/api/auth/register/', {
                'first_name': 'Jo', 'last_name': 'Wren', 'email': 'jowren@example.com', 'password': weak,
            })
            self.assertEqual(res.status_code, 400, weak)
            self.assertIn('password', str(res.data).lower(), weak)
        self.assertFalse(User.objects.exists())

    def test_password_is_hashed(self):
        self.client.post('/api/auth/register/', {'email': 'a@example.com', 'password': STRONG})
        user = User.objects.get()
        self.assertNotEqual(user.password, STRONG)
        self.assertTrue(user.password.startswith(('pbkdf2_', 'argon2', 'scrypt')))


class LoginTests(AuthTestCase):
    def setUp(self):
        super().setUp()
        self.user = User.objects.create_user('amara@example.com', STRONG)

    def test_login_is_case_insensitive(self):
        res = self.client.post('/api/auth/login/', {'email': 'AMARA@Example.com', 'password': STRONG})
        self.assertEqual(res.status_code, 200)

    def test_wrong_password(self):
        res = self.client.post('/api/auth/login/', {'email': 'amara@example.com', 'password': 'nope'})
        self.assertEqual(res.status_code, 400)

    def test_inactive_user_cannot_log_in(self):
        self.user.is_active = False
        self.user.save()
        res = self.client.post('/api/auth/login/', {'email': 'amara@example.com', 'password': STRONG})
        self.assertEqual(res.status_code, 400)

    @override_settings(LOGIN_MAX_FAILURES=3)
    def test_account_locks_after_repeated_failures(self):
        for _ in range(3):
            self.client.post('/api/auth/login/', {'email': 'amara@example.com', 'password': 'bad'})
        # Even the correct password is refused while locked out.
        res = self.client.post('/api/auth/login/', {'email': 'Amara@example.com', 'password': STRONG})
        self.assertEqual(res.status_code, 429)

    def test_successful_login_resets_failure_count(self):
        for _ in range(4):
            self.client.post('/api/auth/login/', {'email': 'amara@example.com', 'password': 'bad'})
        self.assertEqual(self.client.post('/api/auth/login/', {'email': 'amara@example.com', 'password': STRONG}).status_code, 200)
        for _ in range(4):
            self.client.post('/api/auth/login/', {'email': 'amara@example.com', 'password': 'bad'})
        self.assertEqual(self.client.post('/api/auth/login/', {'email': 'amara@example.com', 'password': STRONG}).status_code, 200)

    def test_login_rotates_session_key(self):
        self.client.get('/api/csrf/')
        before = self.client.session.session_key
        self.client.post('/api/auth/login/', {'email': 'amara@example.com', 'password': STRONG})
        self.assertNotEqual(before, self.client.session.session_key)

    def test_logout_ends_session(self):
        self.client.post('/api/auth/login/', {'email': 'amara@example.com', 'password': STRONG})
        self.assertEqual(self.client.post('/api/auth/logout/').status_code, 204)
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 403)


@override_settings(REST_FRAMEWORK={**NO_THROTTLE, 'DEFAULT_THROTTLE_RATES': {'auth': '3/min'}})
class IpThrottleTests(AuthTestCase):
    def test_auth_endpoints_are_rate_limited_per_ip(self):
        codes = [
            self.client.post('/api/auth/login/', {'email': f'u{i}@example.com', 'password': 'x'}).status_code
            for i in range(4)
        ]
        self.assertEqual(codes[-1], 429)


class AccountApiTests(AuthTestCase):
    def setUp(self):
        super().setUp()
        self.user = User.objects.create_user('amara@example.com', STRONG, first_name='Amara')
        self.other = User.objects.create_user('david@example.com', STRONG, first_name='David')

    def test_user_list_requires_authentication(self):
        self.assertEqual(self.client.get('/api/users/').status_code, 403)

    def test_public_profiles_hide_private_fields(self):
        self.client.force_authenticate(self.user)
        for res in (self.client.get('/api/users/'), self.client.get(f'/api/users/{self.other.slug}/')):
            self.assertEqual(res.status_code, 200)
            body = str(res.data)
            self.assertNotIn('david@example.com', body)
            self.assertNotIn('saved_startups', body)

    def test_users_cannot_change_their_own_email_or_role(self):
        self.client.force_authenticate(self.user)
        res = self.client.patch('/api/auth/me/', {'email': 'evil@example.com', 'role': 'super_admin', 'bio': 'hi'})
        self.assertEqual(res.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, 'amara@example.com')
        self.assertEqual(self.user.role, Role.USER)
        self.assertEqual(self.user.bio, 'hi')

    def test_change_password(self):
        self.client.force_login(self.user)
        res = self.client.post('/api/auth/password/', {'current_password': 'wrong', 'new_password': 'An0ther-good-one'})
        self.assertEqual(res.status_code, 400)
        res = self.client.post('/api/auth/password/', {'current_password': STRONG, 'new_password': 'An0ther-good-one'})
        self.assertEqual(res.status_code, 204)
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 200)  # current session survives
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('An0ther-good-one'))

    def test_roles(self):
        mod = User.objects.create_user('mod@example.com', STRONG, role=Role.MODERATOR)
        boss = User.objects.create_superuser('boss@example.com', STRONG)
        self.assertTrue(mod.can_moderate)
        self.assertFalse(mod.has_role(Role.FINANCE_ADMIN))
        self.assertTrue(boss.has_role(Role.FINANCE_ADMIN))
        self.assertEqual(boss.role, Role.SUPER_ADMIN)
        self.assertFalse(self.user.is_platform_admin)
        mod.is_active = False
        self.assertFalse(mod.can_moderate)


@override_settings(GOOGLE_OAUTH_CLIENT_ID='test-client.apps.googleusercontent.com')
class GoogleAuthTests(AuthTestCase):
    def google(self, identity=None, error=None):
        target = 'accounts.views.verify_google_credential'
        if error:
            return mock.patch(target, side_effect=error)
        return mock.patch(target, return_value=identity or google_identity())

    def post(self, path='/api/auth/google/', **data):
        return self.client.post(path, data or {'credential': 'token'})

    def test_new_user_is_created_with_initialised_profile(self):
        with self.google():
            res = self.post()
        self.assertEqual(res.status_code, 201, res.data)
        self.assertTrue(res.data['created'])
        user = User.objects.get(email='new.person@gmail.com')
        self.assertEqual((user.first_name, user.last_name), ('New', 'Person'))
        self.assertTrue(user.slug)
        self.assertTrue(user.email_verified)
        self.assertFalse(user.has_usable_password())
        self.assertEqual(user.role, Role.USER)
        self.assertTrue(SocialAccount.objects.filter(user=user, uid='google-sub-1').exists())
        self.assertEqual(self.client.get('/api/auth/me/').data['google_linked'], True)

    def test_returning_linked_user_signs_in_by_subject_not_email(self):
        user = User.objects.create_user('old@gmail.com', None)
        SocialAccount.objects.create(user=user, provider='google', uid='google-sub-1', email='old@gmail.com')
        with self.google(google_identity(email='renamed@gmail.com')):
            res = self.post()
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['id'], user.id)
        self.assertEqual(User.objects.count(), 1)

    def test_invalid_token_is_rejected(self):
        with self.google(error=GoogleAuthError('Invalid Google credential.')):
            res = self.post()
        self.assertEqual(res.status_code, 400)
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 403)

    def test_unverified_google_email_is_rejected(self):
        with self.google(google_identity(email_verified=False)):
            self.assertEqual(self.post().status_code, 400)
        self.assertFalse(User.objects.exists())

    def test_disabled_account_cannot_sign_in_with_google(self):
        user = User.objects.create_user('new.person@gmail.com', None, is_active=False)
        SocialAccount.objects.create(user=user, provider='google', uid='google-sub-1')
        with self.google():
            self.assertEqual(self.post().status_code, 403)
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 403)

    def test_existing_account_is_linked_automatically_without_password(self):
        user = User.objects.create_user('New.Person@gmail.com', STRONG)
        with self.google():
            res = self.post()
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['id'], user.id)
        self.assertEqual(User.objects.count(), 1)
        self.assertTrue(SocialAccount.objects.filter(user=user, uid='google-sub-1').exists())
        self.assertEqual(self.client.get('/api/auth/me/').data['id'], user.id)
        user.refresh_from_db()
        self.assertTrue(user.email_verified)

    def test_both_login_methods_work_after_auto_link(self):
        user = User.objects.create_user('new.person@gmail.com', STRONG)
        with self.google():
            self.assertEqual(self.post().status_code, 200)
        self.client.post('/api/auth/logout/')

        # Email + password still works...
        res = self.client.post('/api/auth/login/', {'email': 'new.person@gmail.com', 'password': STRONG})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['id'], user.id)
        self.assertTrue(res.data['google_linked'])
        self.client.post('/api/auth/logout/')

        # ...and so does Google, with no password involved.
        with self.google():
            res = self.post()
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['id'], user.id)
        self.assertEqual(SocialAccount.objects.count(), 1)

    def test_account_with_a_different_google_link_is_not_hijacked(self):
        user = User.objects.create_user('new.person@gmail.com', None)
        SocialAccount.objects.create(user=user, provider='google', uid='some-other-sub')
        with self.google():
            self.assertEqual(self.post().status_code, 409)
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 403)

    def test_signed_in_user_can_connect_google(self):
        user = User.objects.create_user('amara@example.com', STRONG)
        self.client.force_login(user)
        with self.google():
            res = self.post()
        self.assertEqual(res.status_code, 200)
        self.assertTrue(SocialAccount.objects.filter(user=user).exists())

    @override_settings(GOOGLE_OAUTH_CLIENT_ID='')
    def test_google_disabled_without_client_id(self):
        res = self.post()
        self.assertEqual(res.status_code, 400)


class TabAuthenticationTests(APITestCase):
    def test_two_tokens_keep_accounts_separate(self):
        for name in ('Alice', 'Bob'):
            user = User(email=f'{name.lower()}@example.com', first_name=name)
            user.set_password('test-password-123')
            user.save()

        clients = []
        for name in ('Alice', 'Bob'):
            client = APIClient()
            response = client.post('/api/auth/login/', {
                'email': f'{name.lower()}@example.com', 'password': 'test-password-123',
            })
            self.assertEqual(response.status_code, 200)
            client.credentials(HTTP_AUTHORIZATION=f"Token {response.data['token']}")
            clients.append(client)

        self.assertEqual(clients[0].get('/api/auth/me/').data['name'], 'Alice')
        self.assertEqual(clients[1].get('/api/auth/me/').data['name'], 'Bob')
        self.assertEqual(clients[0].get('/api/auth/me/').data['name'], 'Alice')
