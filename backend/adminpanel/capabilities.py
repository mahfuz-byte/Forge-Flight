"""What each admin role may do (Phase 5.2).

The frontend builds its navigation from ``capabilities_for(user)``, but every
admin endpoint re-checks the capability server-side: hiding a menu item is a
convenience, never the protection.
"""
from rest_framework import permissions

from accounts.models import ADMIN_ROLES, Role

SUPER, ADMIN = Role.SUPER_ADMIN, Role.ADMIN
MOD, FIN, SUP = Role.MODERATOR, Role.FINANCE_ADMIN, Role.SUPPORT_ADMIN

# capability -> roles holding it (super admins hold every capability).
CAPABILITIES = {
    'dashboard.view': {ADMIN, MOD, FIN, SUP},
    'users.view': {ADMIN, SUP},
    'users.manage': {ADMIN},
    'startups.view': {ADMIN, MOD, FIN, SUP},
    'startups.manage': {ADMIN},
    'investments.view': {ADMIN, FIN},
    'investments.manage': {FIN},
    'collaborations.view': {ADMIN, SUP},
    'content.moderate': {ADMIN, MOD},
    'reports.manage': {ADMIN, MOD},
    'notifications.send': {ADMIN, SUP},
    'analytics.view': {ADMIN, FIN},
    'activity.view': {ADMIN},
    'admins.manage': set(),   # super admin only
    'settings.manage': set(),  # super admin only
}

ROLE_SUMMARIES = {
    SUPER: 'Complete platform control',
    ADMIN: 'General platform management',
    MOD: 'Posts, comments and reports',
    FIN: 'Investment and funding management',
    SUP: 'User assistance and support',
}


def capabilities_for(user):
    if not (user and user.is_authenticated and user.is_platform_admin):
        return set()
    if user.is_superuser or user.role == SUPER:
        return set(CAPABILITIES)
    return {cap for cap, roles in CAPABILITIES.items() if user.role in roles}


def has_capability(user, capability):
    return capability in capabilities_for(user)


class HasCapability(permissions.BasePermission):
    """Checks ``view.admin_capability`` against the signed-in user's role."""

    message = "Your admin role doesn't include access to this area."

    def has_permission(self, request, view):
        capability = getattr(view, 'admin_capability', None)
        return capability is None or has_capability(request.user, capability)


assert set(ROLE_SUMMARIES) == set(ADMIN_ROLES), 'every admin role needs a summary'
