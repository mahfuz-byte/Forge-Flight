"""Writing audit records (SEC-10).

    from audit.log import record
    record('investment.delete', target=inv, amount=str(inv.amount))

The actor, IP and user agent come from the current request, which
``AuditContextMiddleware`` keeps in a context variable, so model signals can
log with an actor too. Pass ``actor=`` to override (e.g. right after login,
before ``request.user`` is updated).
"""
import contextvars
import logging

from django.conf import settings
from django.db import DatabaseError, transaction

logger = logging.getLogger(__name__)

_current_request = contextvars.ContextVar('audit_request', default=None)


class AuditContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        token = _current_request.set(request)
        try:
            return self.get_response(request)
        finally:
            _current_request.reset(token)


def current_request():
    return _current_request.get()


def client_ip(request):
    if request is None:
        return None
    proxies = getattr(settings, 'REST_FRAMEWORK', {}).get('NUM_PROXIES') or 0
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if proxies and forwarded:
        hops = [h.strip() for h in forwarded.split(',') if h.strip()]
        if hops:
            return hops[-min(proxies, len(hops))]
    return request.META.get('REMOTE_ADDR') or None


def _request_actor(request):
    if request is None:
        return None
    # DRF's Request wraps the Django one; both expose .user once authenticated.
    user = getattr(request, 'user', None)
    return user if getattr(user, 'is_authenticated', False) else None


def record(action, target=None, *, actor=None, request=None, target_ref=None, **data):
    """Append an audit entry. Never raises: a logging failure must not break the request.

    ``target_ref=(type, id, repr)`` describes a target that no longer exists as an object.
    """
    from .models import AuditLog

    request = request or current_request()
    actor = actor or _request_actor(request)
    entry = AuditLog(
        action=action,
        actor=actor,
        actor_email=getattr(actor, 'email', '') or '',
        actor_role=getattr(actor, 'role', '') or '',
        data=data,
        ip=client_ip(request),
        user_agent=(request.META.get('HTTP_USER_AGENT', '') if request is not None else '')[:255],
    )
    if target is not None:
        entry.target_type = target._meta.label_lower
        entry.target_id = str(target.pk)
        entry.target_repr = str(target)[:255]
    elif target_ref is not None:
        entry.target_type, entry.target_id, entry.target_repr = (str(v)[:n] for v, n in zip(target_ref, (64, 64, 255)))
    try:
        with transaction.atomic():  # savepoint: a failure here can't poison the caller's transaction
            entry.save()
    except DatabaseError:
        logger.exception('Failed to write audit log entry %s', action)
        return None
    return entry
