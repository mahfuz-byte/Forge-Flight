"""Shared helpers for admin modules."""
from rest_framework.exceptions import PermissionDenied, ValidationError

from .capabilities import has_capability


def require(request, capability):
    """Extra capability needed for a write inside a read-capability viewset."""
    if not has_capability(request.user, capability):
        raise PermissionDenied("Your admin role can't make this change.")


def note_from(request, required=False, field='note', max_length=500):
    note = str(request.data.get(field) or '').strip()
    if required and not note:
        raise ValidationError({field: ['Add a short reason. It is recorded and shown where relevant.']})
    return note[:max_length]


def truthy(value):
    if isinstance(value, str):
        return value.strip().lower() in ('1', 'true', 'yes', 'on')
    return bool(value)
