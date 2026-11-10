from django.conf import settings
from django.db import models


class Notification(models.Model):
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    icon = models.CharField(max_length=40, blank=True)
    color = models.CharField(max_length=40, blank=True)
    text = models.CharField(max_length=255)
    link = models.CharField(max_length=140, blank=True)
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.text[:60]


class Announcement(models.Model):
    """A message staff sent to many people at once (Phase 6, module 7)."""

    AUDIENCE_CHOICES = [
        ('all', 'Everyone'),
        ('founders', 'Founders (own a startup)'),
        ('investors', 'Investors (made an investment request)'),
        ('collaborators', 'Collaborators (applied to a role)'),
        ('staff', 'Staff (any admin role)'),
        ('users', 'Specific people'),
    ]

    sender = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name='+')
    text = models.CharField(max_length=255)
    link = models.CharField(max_length=140, blank=True)
    audience = models.CharField(max_length=20, choices=AUDIENCE_CHOICES)
    recipient_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.get_audience_display()}: {self.text[:60]}'
