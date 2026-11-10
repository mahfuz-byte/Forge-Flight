"""API access-control sweep (SEC-07 / SEC-09).

Walks every URL under /api/ so a newly added endpoint can't silently ship
unprotected: it fails here until it is classified below.
"""
import re

from django.contrib.admindocs.views import extract_views_from_urlpatterns, simplify_regex
from django.urls import get_resolver
from rest_framework.test import APITestCase

from accounts.models import Role, User
from accounts.permissions import HasRole, IsPlatformAdmin

PW = 'c0rrect-Horse-battery'

# Endpoints anonymous visitors may POST to.
ANONYMOUS_WRITES = {
    '/api/auth/register/', '/api/auth/login/', '/api/auth/logout/', '/api/auth/google/',
}
# List endpoints anonymous visitors may read.
PUBLIC_READS = {
    '/api/',  # DRF router's browsable index of endpoint URLs
    '/api/health/', '/api/csrf/', '/api/site/', '/api/startups/', '/api/posts/', '/api/comments/',
}
DENIED = (401, 403)


def api_routes():
    """(path, view) for every /api/ route, with URL parameters filled in."""
    routes = {}
    for view, regex, _ns, _name in extract_views_from_urlpatterns(get_resolver().url_patterns):
        path = simplify_regex(regex)
        # Skip DRF format-suffix duplicates ("/api/posts.json") and the suffix-only root route.
        if not path.startswith('/api/') or not path.endswith('/') or 'format>' in path:
            continue
        path = re.sub(r'<[^>]+>', '1', path)
        routes[path] = view
    return routes


def view_permissions(view):
    cls = getattr(view, 'cls', None) or getattr(getattr(view, 'view_class', None), 'cls', None)
    if cls is None:
        cls = getattr(view, 'view_class', None)
    return list(getattr(cls, 'permission_classes', []) or [])


class AccessSweepTests(APITestCase):
    def test_routes_were_found(self):
        routes = api_routes()
        self.assertIn('/api/posts/', routes)
        self.assertIn('/api/posts/1/', routes)

    def test_anonymous_cannot_write_anywhere(self):
        for path in api_routes():
            if path in ANONYMOUS_WRITES:
                continue
            for method in ('post', 'put', 'patch', 'delete'):
                with self.subTest(path=path, method=method):
                    status = getattr(self.client, method)(path, {}).status_code
                    # 405 = the route doesn't offer that method at all.
                    self.assertIn(status, DENIED + (405,), f'{method.upper()} {path} -> {status}')

    def test_private_lists_need_sign_in(self):
        for path in api_routes():
            if '/1/' in path or path in PUBLIC_READS:
                continue
            if path in ANONYMOUS_WRITES:
                continue
            with self.subTest(path=path):
                status = self.client.get(path).status_code
                self.assertIn(status, DENIED + (405,), f'GET {path} -> {status}; add to PUBLIC_READS if intended')

    def test_admin_api_routes_require_platform_admin(self):
        for path, view in api_routes().items():
            if not path.startswith('/api/admin/'):
                continue
            with self.subTest(path=path):
                perms = view_permissions(view)
                self.assertTrue(
                    any(issubclass(p, (IsPlatformAdmin, HasRole)) for p in perms),
                    f'{path} must use core.admin_api.AdminAPIMixin',
                )

    def test_regular_user_cannot_reach_django_admin(self):
        user = User.objects.create_user('plain@example.com', PW)
        self.client.force_login(user)
        res = self.client.get('/admin/')
        self.assertEqual(res.status_code, 302)  # bounced to the admin login page


class AdminApiMixinTests(APITestCase):
    """The base class Phase 5 admin endpoints inherit from."""

    def test_mixin_permissions(self):
        from rest_framework import viewsets
        from rest_framework.test import APIRequestFactory

        from core.admin_api import AdminAPIMixin

        class FinanceView(AdminAPIMixin, viewsets.ReadOnlyModelViewSet):
            queryset = User.objects.all()
            admin_roles = (Role.FINANCE_ADMIN,)

            def list(self, request):
                from rest_framework.response import Response
                return Response([])

        view = FinanceView.as_view({'get': 'list'})
        factory = APIRequestFactory()
        cases = [
            (None, 403),
            (User.objects.create_user('u@example.com', PW), 403),
            (User.objects.create_user('m@example.com', PW, role=Role.MODERATOR), 403),
            (User.objects.create_user('f@example.com', PW, role=Role.FINANCE_ADMIN), 200),
            (User.objects.create_user('s@example.com', PW, role=Role.SUPER_ADMIN), 200),
        ]
        from rest_framework.test import force_authenticate
        for user, expected in cases:
            with self.subTest(user=user):
                request = factory.get('/api/admin/finance/')
                if user:
                    force_authenticate(request, user=user)
                self.assertEqual(view(request).status_code, expected)
