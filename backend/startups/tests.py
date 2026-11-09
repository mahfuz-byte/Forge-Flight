"""Business-logic tests for applications, investments and funding (Phase 3)."""
from rest_framework.test import APITestCase

from accounts.models import Role, User
from audit.models import AuditLog
from notifications.models import Notification

from .models import Application, CollaborationRole, Investment, Startup

PW = 'c0rrect-Horse-battery'


class Base(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user('owner@example.com', PW, first_name='Owner')
        cls.investor = User.objects.create_user('inv@example.com', PW, first_name='Ivy')
        cls.other = User.objects.create_user('other@example.com', PW, first_name='Otto')

    def setUp(self):
        self.startup = Startup.objects.create(
            slug='acme', name='Acme', owner=self.owner, goal=10_000, external_raised=2_000,
            raised=2_000, status='open',
        )
        CollaborationRole.objects.create(startup=self.startup, role='Flutter Dev', body='Build the app')

    def as_user(self, user):
        self.client.force_authenticate(user)

    def invest(self, amount, user=None):
        self.as_user(user or self.investor)
        return self.client.post('/api/investments/', {'startup': 'acme', 'amount': amount})

    def refresh(self):
        self.startup.refresh_from_db()
        return self.startup


class InvestmentValidationTests(Base):
    """BE-03 / BE-08."""

    def test_valid_request(self):
        res = self.invest(1_000)
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['status'], 'pending')
        self.assertTrue(Notification.objects.filter(recipient=self.owner, text__contains='$1,000').exists())

    def test_cannot_invest_in_own_startup(self):
        res = self.invest(1_000, user=self.owner)
        self.assertEqual(res.status_code, 400)
        self.assertIn('own startup', res.data['detail'])

    def test_amount_limits(self):
        for amount in (0, 50, -5):
            with self.subTest(amount=amount):
                self.assertEqual(self.invest(amount).status_code, 400)
        res = self.invest(8_001)  # only 8,000 left of the goal
        self.assertEqual(res.status_code, 400)
        self.assertIn('8,000', res.data['detail'])
        self.assertIn('amount', res.data)

    def test_round_must_be_open(self):
        Startup.objects.filter(pk='acme').update(status='soon')
        res = self.invest(1_000)
        self.assertEqual(res.status_code, 400)
        self.assertIn('not accepting', res.data['detail'])

    def test_duplicate_pending_request_is_rejected(self):
        self.assertEqual(self.invest(1_000).status_code, 201)
        res = self.invest(500)
        self.assertEqual(res.status_code, 409)
        self.assertEqual(Investment.objects.count(), 1)

    def test_new_request_allowed_after_previous_one_is_decided(self):
        inv_id = self.invest(1_000).data['id']
        self.as_user(self.owner)
        self.client.post(f'/api/investments/{inv_id}/reject/')
        self.assertEqual(self.invest(500).status_code, 201)

    def test_investor_can_change_amount_only_while_pending(self):
        inv_id = self.invest(1_000).data['id']
        res = self.client.patch(f'/api/investments/{inv_id}/', {'amount': 1_500})
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['amount'], 1_500)
        self.as_user(self.owner)
        self.client.post(f'/api/investments/{inv_id}/accept/')
        self.as_user(self.investor)
        self.assertEqual(self.client.patch(f'/api/investments/{inv_id}/', {'amount': 10}).status_code, 409)


class InvestmentDecisionTests(Base):
    """BE-02 / BE-04 / BE-05 / BE-09."""

    def test_accept_updates_funding_atomically(self):
        inv_id = self.invest(3_000).data['id']
        self.as_user(self.owner)
        res = self.client.post(f'/api/investments/{inv_id}/accept/')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['status'], 'accepted')
        self.assertIsNotNone(res.data['decided_at'])
        self.assertEqual(self.refresh().raised, 5_000)
        self.assertEqual(self.client.get('/api/startups/acme/').data['funding_pct'], 50)
        self.assertTrue(AuditLog.objects.filter(action='investment.accepted').exists())
        self.assertTrue(Notification.objects.filter(recipient=self.investor, text__contains='accepted').exists())

    def test_reject_keeps_history_with_reason(self):
        inv_id = self.invest(3_000).data['id']
        self.as_user(self.owner)
        res = self.client.post(f'/api/investments/{inv_id}/reject/', {'reason': 'Round is full'})
        self.assertEqual(res.status_code, 200)
        inv = Investment.objects.get(pk=inv_id)
        self.assertEqual((inv.status, inv.decision_note, inv.decided_by), ('rejected', 'Round is full', self.owner))
        self.assertEqual(self.refresh().raised, 2_000)

    def test_cannot_decide_twice(self):
        inv_id = self.invest(3_000).data['id']
        self.as_user(self.owner)
        self.client.post(f'/api/investments/{inv_id}/accept/')
        res = self.client.post(f'/api/investments/{inv_id}/reject/')
        self.assertEqual(res.status_code, 409)
        self.assertEqual(self.refresh().raised, 5_000)

    def test_only_owner_decides(self):
        inv_id = self.invest(3_000).data['id']
        for user in (self.investor, self.other):
            with self.subTest(user=user.email):
                self.as_user(user)
                status = self.client.post(f'/api/investments/{inv_id}/accept/').status_code
                self.assertIn(status, (403, 404))
        self.assertEqual(Investment.objects.get(pk=inv_id).status, 'pending')

    def test_investments_are_never_deleted(self):
        inv_id = self.invest(3_000).data['id']
        self.assertEqual(self.client.delete(f'/api/investments/{inv_id}/').status_code, 405)
        res = self.client.post(f'/api/investments/{inv_id}/withdraw/')
        self.assertEqual(res.data['status'], 'withdrawn')
        self.assertTrue(Investment.objects.filter(pk=inv_id).exists())
        self.assertEqual(self.client.post(f'/api/investments/{inv_id}/withdraw/').status_code, 409)

    def test_reaching_the_goal_closes_the_round(self):
        inv_id = self.invest(8_000).data['id']
        self.as_user(self.owner)
        self.client.post(f'/api/investments/{inv_id}/accept/')
        s = self.refresh()
        self.assertEqual((s.raised, s.status), (10_000, 'closed'))
        self.assertEqual(self.invest(100, user=self.other).status_code, 400)

    def test_accept_cannot_overshoot_goal(self):
        a = self.invest(6_000).data['id']
        b = self.invest(5_000, user=self.other).data['id']
        self.as_user(self.owner)
        self.assertEqual(self.client.post(f'/api/investments/{a}/accept/').status_code, 200)
        res = self.client.post(f'/api/investments/{b}/accept/')
        self.assertEqual(res.status_code, 409)
        self.assertIn('exceed', res.data['detail'])
        self.assertEqual(self.refresh().raised, 8_000)


class FundingSettingsTests(Base):
    """BE-05 / BE-06: founders manage goal, status and deadline, never `raised`."""

    def test_founder_cannot_type_in_raised(self):
        self.as_user(self.owner)
        res = self.client.patch('/api/startups/acme/', {'raised': 999_999, 'goal': 20_000}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['raised'], 2_000)
        self.assertEqual(res.data['goal'], 20_000)

    def test_cannot_open_round_without_goal(self):
        self.as_user(self.owner)
        res = self.client.post('/api/startups/', {'name': 'New Co', 'status': 'open'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('goal', res.data)
        res = self.client.post('/api/startups/', {'name': 'New Co', 'goal': 5_000, 'status': 'open'}, format='json')
        self.assertEqual(res.status_code, 201, res.data)

    def test_lowering_goal_to_raised_closes_round(self):
        self.as_user(self.owner)
        res = self.client.patch('/api/startups/acme/', {'goal': 2_000}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['status'], 'closed')

    def test_cannot_reopen_a_fully_funded_round(self):
        Startup.objects.filter(pk='acme').update(goal=2_000, status='closed')
        self.as_user(self.owner)
        res = self.client.patch('/api/startups/acme/', {'status': 'open'}, format='json')
        self.assertEqual(res.status_code, 400)
        res = self.client.patch('/api/startups/acme/', {'status': 'open', 'goal': 5_000}, format='json')
        self.assertEqual(res.status_code, 200, res.data)


class CollaborationTests(Base):
    """BE-01 / BE-07 / BE-08."""

    def apply(self, user=None):
        self.as_user(user or self.other)
        return self.client.post('/api/applications/', {
            'startup': 'acme', 'name': 'Otto', 'email': 'otto@example.com', 'message': 'Hi', 'role': 'CEO',
        })

    def test_owner_saves_and_unpublishes_listing(self):
        self.as_user(self.owner)
        res = self.client.put('/api/startups/acme/collaboration/', {
            'role': 'Robotics Engineer', 'body': 'Build drones', 'is_open': True,
        }, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(self.client.get('/api/startups/acme/').data['collab']['role'], 'Robotics Engineer')
        res = self.client.patch('/api/startups/acme/collaboration/', {'is_open': False}, format='json')
        self.assertFalse(res.data['is_open'])
        self.assertEqual(self.apply().status_code, 400)

    def test_listing_needs_title_and_description_to_publish(self):
        self.as_user(self.owner)
        res = self.client.put('/api/startups/acme/collaboration/', {'role': '', 'body': 'x', 'is_open': True}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('role', res.data)

    def test_only_owner_edits_listing(self):
        self.as_user(self.other)
        res = self.client.put('/api/startups/acme/collaboration/', {'role': 'x', 'body': 'y'}, format='json')
        self.assertEqual(res.status_code, 403)

    def test_application_role_comes_from_listing(self):
        res = self.apply()
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['role'], 'Flutter Dev')  # not the 'CEO' the client sent

    def test_no_duplicate_or_self_applications(self):
        self.assertEqual(self.apply().status_code, 201)
        self.assertEqual(self.apply().status_code, 409)
        res = self.apply(user=self.owner)
        self.assertEqual(res.status_code, 400)
        self.assertIn('own startup', res.data['detail'])

    def test_accept_and_decline(self):
        app_id = self.apply().data['id']
        self.as_user(self.other)
        self.assertEqual(self.client.post(f'/api/applications/{app_id}/accept/').status_code, 403)
        self.as_user(self.owner)
        res = self.client.post(f'/api/applications/{app_id}/accept/')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['status'], 'accepted')
        self.assertEqual(self.client.post(f'/api/applications/{app_id}/decline/').status_code, 409)
        self.assertTrue(Notification.objects.filter(recipient=self.other, text__contains='accepted').exists())
        self.assertTrue(AuditLog.objects.filter(action='application.accepted').exists())

    def test_owner_cannot_set_status_through_patch(self):
        app_id = self.apply().data['id']
        self.as_user(self.owner)
        self.assertEqual(self.client.patch(f'/api/applications/{app_id}/', {'status': 'accepted'}).status_code, 403)
        self.assertEqual(Application.objects.get(pk=app_id).status, 'pending')

    def test_withdraw_then_reapply(self):
        app_id = self.apply().data['id']
        self.assertEqual(self.client.delete(f'/api/applications/{app_id}/').status_code, 405)
        res = self.client.post(f'/api/applications/{app_id}/withdraw/')
        self.assertEqual(res.data['status'], 'withdrawn')
        self.assertEqual(self.apply().status_code, 201)

    def test_admin_can_decide(self):
        admin = User.objects.create_user('adm@example.com', PW, role=Role.ADMIN)
        app_id = self.apply().data['id']
        self.as_user(admin)
        self.assertEqual(self.client.post(f'/api/applications/{app_id}/decline/').status_code, 200)
