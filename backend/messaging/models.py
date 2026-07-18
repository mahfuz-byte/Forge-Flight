from django.conf import settings
from django.db import models


class Conversation(models.Model):
    """A thread between a person and a startup's owner."""

    startup = models.ForeignKey('startups.Startup', on_delete=models.CASCADE, related_name='conversations')
    initiator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='conversations')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('startup', 'initiator')
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.initiator} ↔ {self.startup.name}'


class Message(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='messages')
    text = models.TextField()
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'{self.sender}: {self.text[:40]}'
