from django.core.cache import cache
from django.db import models

CACHE_KEY = 'site-settings'


class SiteSettings(models.Model):
    """Platform-wide switches managed by super admins (Phase 6, module 11).

    A single row (pk=1). Read through ``SiteSettings.current()``, which is cached
    and refreshed whenever the row is saved.
    """

    registration_open = models.BooleanField(
        default=True, help_text='New people can create accounts with email and password.',
    )
    google_signin_enabled = models.BooleanField(
        default=True, help_text='"Continue with Google" works (sign-in and sign-up).',
    )
    require_startup_approval = models.BooleanField(
        default=True, help_text='New startups stay hidden until an admin approves them.',
    )
    site_banner = models.CharField(
        max_length=255, blank=True, help_text='Shown at the top of every page when set (e.g. planned maintenance).',
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'site settings'
        verbose_name_plural = 'site settings'

    def __str__(self):
        return 'Site settings'

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)
        cache.delete(CACHE_KEY)

    def delete(self, *args, **kwargs):
        raise ValueError('Site settings cannot be deleted.')

    @classmethod
    def current(cls):
        obj = cache.get(CACHE_KEY)
        if obj is None:
            obj, _ = cls.objects.get_or_create(pk=1)
            cache.set(CACHE_KEY, obj, 60)
        return obj
