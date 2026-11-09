"""Brute-force protection for credential checks (AUTH-08).

Two layers:
  1. DRF ScopedRateThrottle ('auth' scope) limits requests per client IP.
  2. A per-account failure counter here locks an email out after repeated bad
     passwords, so a botnet rotating IPs still can't grind one account.

Both use Django's cache. The default LocMemCache is per-process; in production
set DJANGO_CACHE_URL (Redis) so all workers share the counters.
"""
import hashlib

from django.conf import settings
from django.core.cache import cache


def _key(email):
    digest = hashlib.sha256(email.encode()).hexdigest()
    return f'auth:fail:{digest}'


def is_locked_out(email):
    return cache.get(_key(email), 0) >= settings.LOGIN_MAX_FAILURES


def record_failure(email):
    key = _key(email)
    window = settings.LOGIN_LOCKOUT_SECONDS
    if cache.add(key, 1, window):
        return
    try:
        cache.incr(key)
    except ValueError:  # expired between add() and incr()
        cache.set(key, 1, window)


def clear_failures(email):
    cache.delete(_key(email))
