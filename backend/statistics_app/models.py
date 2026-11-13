from django.conf import settings
from django.db import models
from core.uploads import RandomFilename


class StartupStatisticsReport(models.Model):
    STATUS_READY = 'ready'
    STATUS_ANALYZING = 'analyzing'
    STATUS_COMPLETED = 'completed'
    STATUS_FAILED = 'failed'

    STATUS_CHOICES = [
        (STATUS_READY, 'Ready for Analysis'),
        (STATUS_ANALYZING, 'Analyzing with AI'),
        (STATUS_COMPLETED, 'Analysis Completed'),
        (STATUS_FAILED, 'Analysis Failed'),
    ]

    FILE_CSV = 'csv'
    FILE_PDF = 'pdf'
    FILE_TYPE_CHOICES = [
        (FILE_CSV, 'CSV Spreadsheet'),
        (FILE_PDF, 'PDF Report'),
    ]

    startup = models.ForeignKey(
        'startups.Startup',
        on_delete=models.CASCADE,
        related_name='statistics_reports'
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='statistics_reports'
    )
    file = models.FileField(
        upload_to=RandomFilename('statistics_files'),
        null=True,
        blank=True
    )
    original_filename = models.CharField(max_length=255)
    file_type = models.CharField(max_length=10, choices=FILE_TYPE_CHOICES, default=FILE_CSV)
    
    # Financial & Customer calculated baseline metrics
    raw_summary = models.JSONField(default=dict, blank=True)
    
    # DeepSeek AI generated insights, health score & charts configuration
    ai_analysis = models.JSONField(default=dict, blank=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_READY)
    ai_error = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.startup.name} Stats ({self.original_filename}) - {self.status}"
