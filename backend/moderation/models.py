from django.conf import settings
from django.db import models


class Report(models.Model):
    """A user's report about a post, comment, startup or person.

    Created by members from the Report buttons; reviewed by moderators in the
    admin panel (Phase 6). Only the first open report per reporter and target
    is kept, so repeated clicks don't inflate counts.
    """

    POST, COMMENT, STARTUP, USER = 'post', 'comment', 'startup', 'user'
    TARGET_CHOICES = [(POST, 'Post'), (COMMENT, 'Comment'), (STARTUP, 'Startup'), (USER, 'User')]

    REASON_CHOICES = [
        ('spam', 'Spam or advertising'),
        ('harassment', 'Harassment or hate'),
        ('scam', 'Scam or fraud'),
        ('inappropriate', 'Inappropriate content'),
        ('misinformation', 'False or misleading'),
        ('other', 'Something else'),
    ]

    OPEN, RESOLVED, DISMISSED = 'open', 'resolved', 'dismissed'
    STATUS_CHOICES = [(OPEN, 'Open'), (RESOLVED, 'Resolved'), (DISMISSED, 'Dismissed')]

    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name='reports_filed',
    )
    target_type = models.CharField(max_length=10, choices=TARGET_CHOICES)
    target_id = models.CharField(max_length=64)
    # Snapshot so the report stays readable if the content is later removed.
    target_repr = models.CharField(max_length=255, blank=True)
    reason = models.CharField(max_length=20, choices=REASON_CHOICES, default='other')
    details = models.TextField(blank=True, max_length=1000)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=OPEN, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    handled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+',
    )
    handled_at = models.DateTimeField(null=True, blank=True)
    resolution = models.TextField(blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['target_type', 'target_id'])]
        constraints = [
            models.UniqueConstraint(
                fields=['reporter', 'target_type', 'target_id'], condition=models.Q(status='open'),
                name='one_open_report_per_reporter_target',
            ),
        ]

    def __str__(self):
        return f'{self.get_target_type_display()} report: {self.target_repr or self.target_id} ({self.status})'
