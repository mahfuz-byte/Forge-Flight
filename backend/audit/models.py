from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    """An append-only record of a sensitive operation (SEC-10).

    Actor and target are snapshotted as text as well as linked, so the record
    still reads correctly after the user or object is deleted.
    """

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='audit_actions',
    )
    actor_email = models.EmailField(blank=True)
    actor_role = models.CharField(max_length=20, blank=True)
    action = models.CharField(max_length=64, db_index=True)
    target_type = models.CharField(max_length=64, blank=True)
    target_id = models.CharField(max_length=64, blank=True)
    target_repr = models.CharField(max_length=255, blank=True)
    # Free-form details: changed fields as {"field": [old, new]}, reasons, etc.
    # Never put passwords, tokens or file contents here.
    data = models.JSONField(default=dict, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [models.Index(fields=['target_type', 'target_id'])]

    def __str__(self):
        who = self.actor_email or 'system'
        return f'{self.created_at:%Y-%m-%d %H:%M} {who} {self.action} {self.target_repr}'.strip()

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValueError('Audit log entries are immutable.')
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError('Audit log entries cannot be deleted.')
