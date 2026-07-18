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
