"""Admin panel foundation (Phase 5) and member reports."""
from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import Role, User
from audit.log import record
from moderation.models import Report
from posts.models import Post
from startups.models import Application, Investment, Startup

from .capabilities import CAPABILITIES, capabilities_for

PW = 'c0rrect-Horse-battery'


def make(email, role=Role.USER, **kw):
    return User.objects.create_user(email, PW, first_name=email.split('@')[0].title(), role=role, **kw)


class AccessTests(APITestCase):
    """Regular users can't reach any admin endpoint; each role sees only its areas."""

    @classmethod
    def setUpTestData(cls):
        cls.users = {role: make(f'{role}@example.com', role) for role in Role.values}

    def get(self, role, url):
        self.client.force_authenticate(self.users[role] if role else None)
        return self.client.get(url).status_code

    def test_regular_and_anonymous_users_are_refused(self):
        for url in ('/api/admin/me/', '/api/admin/dashboard/', '/api/admin/activity/'):
            with self.subTest(url=url):
                self.assertEqual(self.get(None, url), 403)
                self.assertEqual(self.get(Role.USER, url), 403)

    def test_every_admin_role_gets_the_dashboard(self):
        for role in (Role.SUPPORT_ADMIN, Role.MODERATOR, Role.FINANCE_ADMIN, Role.ADMIN, Role.SUPER_ADMIN):
            with self.subTest(role=role):
                self.assertEqual(self.get(role, '/api/admin/dashboard/'), 200)

    def test_activity_log_is_admin_and_super_admin_only(self):
        expected = {
            Role.SUPPORT_ADMIN: 403, Role.MODERATOR: 403, Role.FINANCE_ADMIN: 403,
            Role.ADMIN: 200, Role.SUPER_ADMIN: 200,
        }
        for role, status in expected.items():
            with self.subTest(role=role):
                self.assertEqual(self.get(role, '/api/admin/activity/'), status)

    def test_me_lists_capabilities(self):
        self.client.force_authenticate(self.users[Role.MODERATOR])
        data = self.client.get('/api/admin/me/').data
        self.assertEqual(data['role'], 'moderator')
        self.assertIn('content.moderate', data['capabilities'])
        self.assertNotIn('users.manage', data['capabilities'])
        self.client.force_authenticate(self.users[Role.SUPER_ADMIN])
        self.assertEqual(set(self.client.get('/api/admin/me/').data['capabilities']), set(CAPABILITIES))

    def test_suspended_admin_loses_access(self):
        admin = make('gone@example.com', Role.ADMIN, is_active=False)
        self.assertEqual(capabilities_for(admin), set())

    def test_super_admin_only_capabilities(self):
        for role in (Role.ADMIN, Role.MODERATOR, Role.FINANCE_ADMIN, Role.SUPPORT_ADMIN):
            caps = capabilities_for(self.users[role])
            self.assertNotIn('admins.manage', caps)
            self.assertNotIn('settings.manage', caps)


class DashboardTests(APITestCase):
    def test_numbers_match_the_database(self):
        owner = make('owner@example.com')
        fan = make('fan@example.com')
        make('old@example.com', is_active=False)
        User.objects.filter(pk=owner.pk).update(last_login=timezone.now() - timedelta(days=2))
        User.objects.filter(pk=fan.pk).update(last_login=timezone.now() - timedelta(days=90))
        s1 = Startup.objects.create(slug='a', name='A', owner=owner, goal=10_000, status='open')
        Startup.objects.create(slug='b', name='B', owner=owner, verified=True)
        Investment.objects.create(startup=s1, investor=fan, amount=500)
        Investment.objects.create(
            startup=s1, investor=make('rich@example.com'), amount=2_000, status='accepted', decided_at=timezone.now(),
        )
        Application.objects.create(startup=s1, applicant=fan, role='Dev')
        post = Post.objects.create(title='x', author=owner)
        Report.objects.create(reporter=fan, target_type='post', target_id=str(post.pk), target_repr='x')

        admin = make('boss@example.com', Role.ADMIN)
        self.client.force_authenticate(admin)
        data = self.client.get('/api/admin/dashboard/').data
        stats = data['stats']
        self.assertEqual(stats['total_users'], 5)
        self.assertEqual(stats['active_users'], 1)
        self.assertEqual(stats['suspended_users'], 1)
        self.assertEqual(stats['total_startups'], 2)
        self.assertEqual(stats['pending_startup_approvals'], 1)
        self.assertEqual((stats['investment_requests'], stats['investment_requests_amount']), (1, 500))
        self.assertEqual((stats['accepted_investments'], stats['accepted_investments_amount']), (1, 2_000))
        self.assertEqual(stats['pending_collaborations'], 1)
        self.assertEqual(stats['reported_content'], 1)

        charts = data['charts']
        self.assertEqual(len(charts['months']), 12)
        self.assertEqual(charts['user_growth'][-1], 5)
        self.assertEqual(charts['startup_growth'][-1], 2)
        self.assertEqual(charts['investment_accepted_amount'][-1], 2_000)
        types = {e['type'] for e in data['recent_activity']}
        self.assertTrue({'user', 'startup', 'investment', 'application', 'report'} <= types)


class ActivityLogTests(APITestCase):
    def test_pagination_and_filters(self):
        admin = make('boss@example.com', Role.ADMIN)
        for i in range(30):
            record('test.event', actor=admin, n=i)
        record('auth.login', actor=admin)
        self.client.force_authenticate(admin)
        page = self.client.get('/api/admin/activity/?page_size=10&action=test.').data
        self.assertEqual(page['count'], 30)
        self.assertEqual(page['total_pages'], 3)
        self.assertEqual(len(page['results']), 10)
        self.assertEqual(self.client.get('/api/admin/activity/?q=auth.login').data['count'], 1)
        self.assertEqual(self.client.get('/api/admin/activity/?page_size=500').data['page_size'], 100)

    def test_activity_is_read_only(self):
        admin = make('boss@example.com', Role.SUPER_ADMIN)
        entry = record('test.event', actor=admin)
        self.client.force_authenticate(admin)
        self.assertEqual(self.client.delete(f'/api/admin/activity/{entry.pk}/').status_code, 405)
        self.assertEqual(self.client.post('/api/admin/activity/', {}).status_code, 405)


class ReportTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.author = make('author@example.com')
        cls.reader = make('reader@example.com')
        cls.post = Post.objects.create(title='Buy crypto now', author=cls.author)

    def report(self, user, **body):
        self.client.force_authenticate(user)
        payload = {'target_type': 'post', 'target_id': self.post.pk, 'reason': 'spam', **body}
        return self.client.post('/api/reports/', payload)

    def test_report_is_recorded_once(self):
        res = self.report(self.reader, details='Scam link')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(self.report(self.reader).status_code, 200)
        self.assertEqual(Report.objects.count(), 1)
        self.assertEqual(Report.objects.get().target_repr, 'Buy crypto now')

    def test_cannot_report_own_or_missing_content(self):
        self.assertEqual(self.report(self.author).status_code, 400)
        self.assertEqual(self.report(self.reader, target_id=99999).status_code, 404)
        self.assertEqual(self.report(self.reader, target_type='planet').status_code, 400)

    def test_guests_cannot_report(self):
        self.client.force_authenticate(None)
        res = self.client.post('/api/reports/', {'target_type': 'post', 'target_id': self.post.pk})
        self.assertEqual(res.status_code, 403)
