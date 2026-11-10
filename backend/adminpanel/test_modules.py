"""Phase 6 admin modules."""
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import Role, User
from audit.models import AuditLog
from core.models import SiteSettings
from moderation.models import Report
from notifications.models import Notification
from posts.models import Post
from startups.models import Application, CollaborationRole, Investment, Startup, StartupComment

PW = 'c0rrect-Horse-battery'


def make(email, role=Role.USER, **kw):
    return User.objects.create_user(email, PW, first_name=email.split('@')[0].title(), role=role, **kw)


class Base(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.super = make('super@example.com', Role.SUPER_ADMIN)
        cls.admin = make('admin@example.com', Role.ADMIN)
        cls.mod = make('mod@example.com', Role.MODERATOR)
        cls.fin = make('fin@example.com', Role.FINANCE_ADMIN)
        cls.sup = make('sup@example.com', Role.SUPPORT_ADMIN)
        cls.owner = make('owner@example.com')
        cls.member = make('member@example.com')

    def setUp(self):
        cache.clear()  # SiteSettings and throttles are cached

    def as_user(self, user):
        self.client.force_authenticate(user)


class UserManagementTests(Base):
    def test_search_and_filters(self):
        self.as_user(self.sup)
        res = self.client.get('/api/admin/users/?q=owner')
        self.assertEqual([u['email'] for u in res.data['results']], ['owner@example.com'])
        self.assertEqual(self.client.get('/api/admin/users/?role=moderator').data['count'], 1)
        detail = self.client.get(f'/api/admin/users/{self.owner.pk}/').data
        self.assertIn('investments_count', detail)

    def test_support_can_view_but_not_suspend(self):
        self.as_user(self.sup)
        res = self.client.post(f'/api/admin/users/{self.member.pk}/suspend/', {'reason': 'spam'})
        self.assertEqual(res.status_code, 403)

    def test_suspend_and_reactivate(self):
        self.as_user(self.admin)
        self.assertEqual(self.client.post(f'/api/admin/users/{self.member.pk}/suspend/').status_code, 400)  # reason required
        res = self.client.post(f'/api/admin/users/{self.member.pk}/suspend/', {'reason': 'Spam bot'})
        self.assertEqual(res.status_code, 200, res.data)
        self.member.refresh_from_db()
        self.assertFalse(self.member.is_active)
        self.assertTrue(AuditLog.objects.filter(action='admin.user_suspended', data__reason='Spam bot').exists())
        # A suspended member can't sign in any more.
        self.client.force_authenticate(None)
        res = self.client.post('/api/auth/login/', {'email': 'member@example.com', 'password': PW})
        self.assertEqual(res.status_code, 400)
        self.as_user(self.admin)
        self.assertEqual(self.client.post(f'/api/admin/users/{self.member.pk}/activate/').status_code, 200)

    def test_admin_cannot_suspend_staff_or_self(self):
        self.as_user(self.admin)
        self.assertEqual(self.client.post(f'/api/admin/users/{self.mod.pk}/suspend/', {'reason': 'x'}).status_code, 403)
        self.assertEqual(self.client.post(f'/api/admin/users/{self.admin.pk}/suspend/', {'reason': 'x'}).status_code, 403)
        self.as_user(self.super)
        self.assertEqual(self.client.post(f'/api/admin/users/{self.mod.pk}/suspend/', {'reason': 'x'}).status_code, 200)


class StartupManagementTests(Base):
    def test_api_created_startups_wait_for_approval(self):
        self.as_user(self.owner)
        slug = self.client.post('/api/startups/', {'name': 'Fresh Co'}, format='json').data['slug']
        self.assertEqual(Startup.objects.get(pk=slug).review_status, 'pending')
        # Hidden from others, visible to its owner and to reviewers.
        self.as_user(self.member)
        self.assertEqual(self.client.get(f'/api/startups/{slug}/').status_code, 404)
        self.client.force_authenticate(None)
        self.assertNotIn(slug, [s['slug'] for s in self.client.get('/api/startups/').data])
        self.as_user(self.owner)
        self.assertEqual(self.client.get(f'/api/startups/{slug}/').status_code, 200)

        self.as_user(self.admin)
        queue = self.client.get('/api/admin/startups/?review_status=pending').data
        self.assertEqual([s['slug'] for s in queue['results']], [slug])
        res = self.client.post(f'/api/admin/startups/{slug}/review/', {'decision': 'approve'})
        self.assertEqual(res.data['review_status'], 'approved')
        self.assertTrue(Notification.objects.filter(recipient=self.owner, text__contains='approved').exists())
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f'/api/startups/{slug}/').status_code, 200)

    def test_approval_can_be_turned_off(self):
        SiteSettings.objects.update_or_create(pk=1, defaults={'require_startup_approval': False})
        cache.clear()
        self.as_user(self.owner)
        slug = self.client.post('/api/startups/', {'name': 'Instant Co'}, format='json').data['slug']
        self.assertEqual(Startup.objects.get(pk=slug).review_status, 'approved')

    def test_reject_resubmit_suspend_restore_feature(self):
        s = Startup.objects.create(slug='acme', name='Acme', owner=self.owner, review_status='pending')
        self.as_user(self.admin)
        self.assertEqual(self.client.post('/api/admin/startups/acme/review/', {'decision': 'reject'}).status_code, 400)
        res = self.client.post('/api/admin/startups/acme/review/', {'decision': 'reject', 'note': 'Add a real overview.'})
        self.assertEqual(res.data['review_status'], 'rejected')
        # Founder edits → back in the queue.
        self.as_user(self.owner)
        self.client.patch('/api/startups/acme/', {'overview': 'A real overview.'}, format='json')
        s.refresh_from_db()
        self.assertEqual(s.review_status, 'pending')

        self.as_user(self.admin)
        self.client.post('/api/admin/startups/acme/review/', {'decision': 'approve'})
        res = self.client.post('/api/admin/startups/acme/flags/', {'featured': True, 'verified': True})
        self.assertTrue(res.data['featured'] and res.data['verified'])
        res = self.client.post('/api/admin/startups/acme/review/', {'decision': 'suspend', 'note': 'Fraud investigation'})
        self.assertEqual((res.data['review_status'], res.data['featured']), ('suspended', False))
        # Suspended startups take no investments.
        Startup.objects.filter(pk='acme').update(goal=1000, status='open')
        self.as_user(self.member)
        self.assertEqual(self.client.post('/api/investments/', {'startup': 'acme', 'amount': 100}).status_code, 400)
        self.as_user(self.admin)
        self.assertEqual(self.client.post('/api/admin/startups/acme/review/', {'decision': 'restore'}).data['review_status'], 'approved')

    def test_moderator_can_view_but_not_review(self):
        Startup.objects.create(slug='acme', name='Acme', owner=self.owner, review_status='pending')
        self.as_user(self.mod)
        self.assertEqual(self.client.get('/api/admin/startups/').status_code, 200)
        self.assertEqual(self.client.post('/api/admin/startups/acme/review/', {'decision': 'approve'}).status_code, 403)


class FinanceAndCollaborationTests(Base):
    def setUp(self):
        super().setUp()
        self.s = Startup.objects.create(slug='acme', name='Acme', owner=self.owner, goal=10_000, raised=2_000,
                                        external_raised=1_000, status='open')
        Investment.objects.create(startup=self.s, investor=self.member, amount=1_000, status='accepted', decided_at=timezone.now())
        Investment.objects.create(startup=self.s, investor=self.sup, amount=500)
        CollaborationRole.objects.create(startup=self.s, role='Dev', body='Build')
        Application.objects.create(startup=self.s, applicant=self.member, role='Dev')

    def test_investment_list_and_monitor(self):
        self.as_user(self.fin)
        self.assertEqual(self.client.get('/api/admin/investments/?status=pending').data['count'], 1)
        self.assertEqual(self.client.get('/api/admin/investments/?min_amount=900').data['count'], 1)
        summary = self.client.get('/api/admin/investments/summary/').data
        self.assertEqual(summary['by_status']['accepted'], {'count': 1, 'amount': 1_000})
        acme = summary['rounds'][0]
        self.assertEqual((acme['platform_raised'], acme['pending_amount'], acme['drift']), (1_000, 500, 0))
        self.as_user(self.mod)
        self.assertEqual(self.client.get('/api/admin/investments/').status_code, 403)

    def test_collaborations(self):
        self.as_user(self.sup)
        self.assertEqual(self.client.get('/api/admin/collaborations/?status=pending').data['count'], 1)
        listings = self.client.get('/api/admin/collaborations/listings/').data
        self.assertEqual((listings[0]['applicants'], listings[0]['pending']), (1, 1))
        self.assertEqual(self.client.post('/api/admin/collaborations/listings/acme/close/', {'note': 'x'}).status_code, 403)
        self.as_user(self.admin)
        res = self.client.post('/api/admin/collaborations/listings/acme/close/', {'note': 'Unpaid work offer'})
        self.assertEqual(res.status_code, 200)
        self.assertFalse(CollaborationRole.objects.get().is_open)


class CommunityAndReportTests(Base):
    def setUp(self):
        super().setUp()
        self.s = Startup.objects.create(slug='acme', name='Acme', owner=self.owner)
        self.post = Post.objects.create(title='Spammy', author=self.owner, startup=self.s)
        self.comment = StartupComment.objects.create(startup=self.s, author=self.owner, text='buy now')
        for reporter in (self.member, self.sup):
            Report.objects.create(reporter=reporter, target_type='post', target_id=str(self.post.pk), target_repr='Spammy', reason='spam')

    def test_reported_posts_float_to_top_and_removal_needs_reason(self):
        Post.objects.create(title='Fine', author=self.member)
        self.as_user(self.mod)
        rows = self.client.get('/api/admin/posts/').data['results']
        self.assertEqual((rows[0]['title'], rows[0]['open_reports']), ('Spammy', 2))
        self.assertEqual(self.client.get('/api/admin/posts/?reported=1').data['count'], 1)
        self.assertEqual(self.client.delete(f'/api/admin/posts/{self.post.pk}/').status_code, 400)
        res = self.client.delete(f'/api/admin/posts/{self.post.pk}/?reason=Spam')
        self.assertEqual(res.status_code, 204)
        self.assertFalse(Post.objects.filter(pk=self.post.pk).exists())
        self.assertEqual(Report.objects.filter(status='open').count(), 0)  # its reports were closed
        self.assertTrue(Notification.objects.filter(recipient=self.owner, text__contains='removed').exists())

    def test_comment_moderation(self):
        self.as_user(self.mod)
        self.assertEqual(self.client.get('/api/admin/comments/?q=buy').data['count'], 1)
        self.assertEqual(self.client.delete(f'/api/admin/comments/{self.comment.pk}/', {'reason': 'Spam'}).status_code, 204)

    def test_resolve_report_by_removing_content(self):
        report = Report.objects.first()
        self.as_user(self.mod)
        rows = self.client.get('/api/admin/reports/').data['results']
        self.assertEqual(rows[0]['same_target_open'], 2)
        self.assertTrue(rows[0]['target']['exists'])
        res = self.client.post(f'/api/admin/reports/{report.pk}/resolve/', {'resolution': 'Spam link', 'action': 'remove_content'})
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['status'], 'resolved')
        self.assertEqual(Report.objects.filter(status='resolved').count(), 2)
        self.assertFalse(Post.objects.filter(pk=self.post.pk).exists())

    def test_dismiss_and_permissions(self):
        report = Report.objects.first()
        self.as_user(self.sup)
        self.assertEqual(self.client.get('/api/admin/reports/').status_code, 403)
        self.as_user(self.mod)
        res = self.client.post(f'/api/admin/reports/{report.pk}/dismiss/', {'resolution': 'Not spam'})
        self.assertEqual(res.data['status'], 'dismissed')
        self.assertEqual(self.client.post(f'/api/admin/reports/{report.pk}/dismiss/', {'resolution': 'x'}).status_code, 400)
        # Moderators can't suspend users through a report.
        r = Report.objects.create(reporter=self.member, target_type='user', target_id=str(self.owner.pk), reason='scam')
        res = self.client.post(f'/api/admin/reports/{r.pk}/resolve/', {'resolution': 'x', 'action': 'suspend_user'})
        self.assertEqual(res.status_code, 403)


class AnnouncementTests(Base):
    def test_send_to_founders_and_history(self):
        Startup.objects.create(slug='acme', name='Acme', owner=self.owner)
        self.as_user(self.sup)
        self.assertEqual(self.client.get('/api/admin/announcements/preview/?audience=founders').data['recipients'], 1)
        res = self.client.post('/api/admin/announcements/', {'text': 'Pitch day Friday', 'link': '/feed', 'audience': 'founders'}, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['recipient_count'], 1)
        self.assertTrue(Notification.objects.filter(recipient=self.owner, text='Pitch day Friday').exists())
        self.assertFalse(Notification.objects.filter(recipient=self.member, text='Pitch day Friday').exists())
        self.assertEqual(self.client.get('/api/admin/announcements/').data['count'], 1)

    def test_validation(self):
        self.as_user(self.admin)
        post = lambda body: self.client.post('/api/admin/announcements/', body, format='json')  # noqa: E731
        self.assertEqual(post({'text': 'x', 'audience': 'users'}).status_code, 400)
        self.assertEqual(post({'text': 'x', 'audience': 'all', 'link': 'https://evil.example'}).status_code, 400)
        res = post({'text': 'Hi', 'audience': 'users', 'user_ids': [self.member.pk]})
        self.assertEqual(res.data['recipient_count'], 1)
        self.as_user(self.mod)
        self.assertEqual(post({'text': 'x', 'audience': 'all'}).status_code, 403)


class AnalyticsTests(Base):
    def test_totals_series_and_exports(self):
        s = Startup.objects.create(slug='acme', name='=cmd|calc', owner=self.owner, goal=1000)
        Investment.objects.create(startup=s, investor=self.member, amount=300, status='accepted', decided_at=timezone.now())
        Investment.objects.create(startup=s, investor=self.sup, amount=200, status='rejected', decided_at=timezone.now())
        self.as_user(self.fin)
        data = self.client.get('/api/admin/analytics/').data
        self.assertEqual(data['unit'], 'day')
        self.assertEqual(len(data['series']['labels']), 30)
        self.assertEqual(data['totals']['investment_acceptance_rate'], 50)
        self.assertEqual(data['totals']['investment_accepted_amount'], 300)
        self.assertEqual(self.client.get('/api/admin/analytics/?from=2026-02-01&to=2025-01-01').status_code, 400)

        res = self.client.get('/api/admin/analytics/export/?dataset=investments')
        self.assertEqual(res.status_code, 200)
        self.assertIn('attachment', res['Content-Disposition'])
        body = res.content.decode('utf-8-sig')
        self.assertIn('member@example.com', body)
        # Finance admins can't export the user list (needs users.view).
        self.assertEqual(self.client.get('/api/admin/analytics/export/?dataset=users').status_code, 403)
        self.as_user(self.admin)
        body = self.client.get('/api/admin/analytics/export/?dataset=startups').content.decode('utf-8-sig')
        self.assertIn("'=cmd|calc", body)  # formula neutralised


class AdminManagementTests(Base):
    def test_role_assignment_rules(self):
        self.as_user(self.admin)
        self.assertEqual(self.client.get('/api/admin/staff/').status_code, 403)
        self.as_user(self.super)
        self.assertEqual(len(self.client.get('/api/admin/staff/').data['results']), 5)
        res = self.client.post('/api/admin/staff/set-role/', {'email': 'MEMBER@example.com', 'role': 'moderator'})
        self.assertEqual(res.data['role'], 'moderator')
        self.assertTrue(AuditLog.objects.filter(action='user.privileges_changed', target_id=str(self.member.pk)).exists())
        self.assertEqual(self.client.post('/api/admin/staff/set-role/', {'user_id': self.super.pk, 'role': 'user'}).status_code, 403)
        roles = self.client.get('/api/admin/roles/').data['roles']
        self.assertEqual({r['role'] for r in roles}, {'support_admin', 'moderator', 'finance_admin', 'admin', 'super_admin'})

    def test_last_super_admin_cannot_be_demoted(self):
        other = make('other-super@example.com', Role.SUPER_ADMIN)
        self.as_user(other)
        self.assertEqual(self.client.post('/api/admin/staff/set-role/', {'user_id': self.super.pk, 'role': 'admin'}).status_code, 200)
        # `other` is now the only super admin; nobody else can remove them and they can't demote themselves.
        self.as_user(other)
        self.assertEqual(self.client.post('/api/admin/staff/set-role/', {'user_id': other.pk, 'role': 'admin'}).status_code, 403)


class SystemSettingsTests(Base):
    def tearDown(self):
        cache.clear()

    def test_only_super_admin_and_settings_are_enforced(self):
        self.as_user(self.admin)
        self.assertEqual(self.client.get('/api/admin/settings/').status_code, 403)
        self.as_user(self.super)
        data = self.client.get('/api/admin/settings/').data
        self.assertTrue(data['registration_open'])
        self.assertIn('login_max_failures', data['security'])
        res = self.client.patch('/api/admin/settings/', {'registration_open': False, 'site_banner': 'Maintenance at 22:00'}, format='json')
        self.assertFalse(res.data['registration_open'])
        self.assertTrue(AuditLog.objects.filter(action='admin.settings_changed').exists())

        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/site/').data['site_banner'], 'Maintenance at 22:00')
        res = self.client.post('/api/auth/register/', {'email': 'new@example.com', 'password': PW, 'first_name': 'N'})
        self.assertEqual(res.status_code, 403)
        self.assertIn('paused', res.data['detail'])
