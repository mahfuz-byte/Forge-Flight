"""Reusable DRF permission classes (AUTH-09 / AUTH-10).

All authorization is decided server-side from the local User row; nothing the
client sends (role names, owner ids) is trusted.
"""
from rest_framework import permissions

from .models import Role


def _resolve(obj, path):
    """Follow a dotted attribute path such as ``'startup.owner_id'``."""
    for part in path.split('.'):
        if obj is None:
            return None
        obj = getattr(obj, part, None)
    return obj


class HasRole(permissions.BasePermission):
    """Grants access to users holding one of ``roles``.

    Use via the factory: ``permission_classes = [HasRole.of(Role.MODERATOR)]``.
    """

    roles = ()

    @classmethod
    def of(cls, *roles):
        return type(f'HasRole_{"_".join(roles)}', (cls,), {'roles': roles})

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.has_role(*self.roles))


class IsPlatformAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_platform_admin)


class IsOwnerOrReadOnly(permissions.BasePermission):
    """Anyone may read; only the owner (or an allowed staff role) may write.

    Configure on the view:
      owner_field  dotted path to the owner's id, e.g. ``'author_id'``
      staff_roles  roles that may also write, e.g. ``(Role.MODERATOR,)``
    """

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return is_owner_or_staff(request.user, obj, view)


class IsOwner(permissions.BasePermission):
    """Like IsOwnerOrReadOnly, but reads are restricted too."""

    def has_object_permission(self, request, view, obj):
        return is_owner_or_staff(request.user, obj, view)


def is_owner_or_staff(user, obj, view):
    if not (user and user.is_authenticated):
        return False
    owner_field = getattr(view, 'owner_field', 'owner_id')
    if _resolve(obj, owner_field) == user.id:
        return True
    staff_roles = getattr(view, 'staff_roles', ())
    return bool(staff_roles) and user.has_role(*staff_roles)


__all__ = ['HasRole', 'IsOwner', 'IsOwnerOrReadOnly', 'IsPlatformAdmin', 'Role', 'is_owner_or_staff']
