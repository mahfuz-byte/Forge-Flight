from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.db import models


class Post(models.Model):
    KIND_CHOICES = [
        ('update', 'Startup Update'),
        ('event', 'Event'),
    ]

    kind = models.CharField(max_length=10, choices=KIND_CHOICES, default='update')
    startup = models.ForeignKey(
        'startups.Startup', on_delete=models.CASCADE, related_name='posts',
        null=True, blank=True,
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='posts',
        null=True, blank=True,
    )
    post_type = models.CharField(max_length=60, blank=True)
    title = models.CharField(max_length=255)
    text = models.TextField(blank=True)
    tags = ArrayField(models.CharField(max_length=40), blank=True, default=list)
    media = models.CharField(max_length=140, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title
