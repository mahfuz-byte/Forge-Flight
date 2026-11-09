"""Foundation for the platform admin API (SEC-09), used by Phase 5's /api/admin/.

Every admin endpoint must:
  * live under ``/api/admin/`` (a test enforces the permission below for that prefix),
  * inherit ``AdminAPIMixin`` so access is decided server-side from the user's
    role, never from anything the client sends,
  * narrow access further with ``admin_roles`` where only some roles apply.

Writes through these views are audit-logged automatically.
"""
from rest_framework import permissions

from accounts.permissions import HasRole, IsPlatformAdmin
from audit.log import record


class AdminAPIMixin:
    permission_classes = [permissions.IsAuthenticated, IsPlatformAdmin]
    # e.g. (Role.FINANCE_ADMIN,) — super admins always pass.
    admin_roles = ()

    def get_permissions(self):
        perms = [p() for p in self.permission_classes]
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
