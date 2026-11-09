"""Foundation for the platform admin API (SEC-09), used by Phase 5's /api/admin/.

Every admin endpoint must:
  * live under ``/api/admin/`` (a test enforces the permission below for that prefix),
  * inherit ``AdminAPIMixin`` so access is decided server-side from the user's
    role, never from anything the client sends,
  * name the capability it needs in ``admin_capability`` (see
    adminpanel/capabilities.py); ``admin_roles`` narrows by role directly.

Writes through these views are audit-logged automatically.
"""
from rest_framework import permissions
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from accounts.permissions import HasRole, IsPlatformAdmin
from audit.log import record


class AdminPagination(PageNumberPagination):
    """Server-side pagination for every admin table: ``?page=&page_size=``."""

    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 100

    def get_paginated_response(self, data):
        return Response({
            'count': self.page.paginator.count,
            'page': self.page.number,
            'page_size': self.get_page_size(self.request),
            'total_pages': self.page.paginator.num_pages,
            'results': data,
        })


class AdminAPIMixin:
    permission_classes = [permissions.IsAuthenticated, IsPlatformAdmin]
    pagination_class = AdminPagination
    # e.g. 'users.manage' — checked server-side for every request.
    admin_capability = None
    # e.g. (Role.FINANCE_ADMIN,) — super admins always pass.
    admin_roles = ()

    def get_permissions(self):
        from adminpanel.capabilities import HasCapability

        perms = [p() for p in self.permission_classes]
        if self.admin_capability:
            perms.append(HasCapability())
        if self.admin_roles:
            perms.append(HasRole.of(*self.admin_roles)())
        return perms

    def _label(self):
        return self.get_queryset().model._meta.model_name

    def perform_create(self, serializer):
        super().perform_create(serializer)
        record(f'admin_api.{self._label()}.create', serializer.instance)

    def perform_update(self, serializer):
        fields = sorted(serializer.validated_data)
        super().perform_update(serializer)
        record(f'admin_api.{self._label()}.update', serializer.instance, fields=fields)

    def perform_destroy(self, instance):
        record(f'admin_api.{self._label()}.delete', instance)
        super().perform_destroy(instance)
