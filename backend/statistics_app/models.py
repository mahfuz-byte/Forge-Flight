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
    is_published = models.BooleanField(default=True, db_index=True)
    reporting_period = models.CharField(max_length=80, blank=True, default='')
    
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


class StartupAIVerdict(models.Model):
    startup = models.OneToOneField(
        'startups.Startup',
        on_delete=models.CASCADE,
        related_name='ai_verdict'
    )
    valuation_low = models.BigIntegerField(default=0)
    valuation_high = models.BigIntegerField(default=0)
    valuation_multiple = models.CharField(max_length=80, blank=True, default="4x - 6x ARR")
    valuation_rationale = models.TextField(blank=True)
    
    historical_mom_growth = models.FloatField(default=0.0)
    projected_annual_growth = models.FloatField(default=0.0)
    growth_stage = models.CharField(max_length=60, blank=True, default="Early Stage")
    
    future_projections = models.JSONField(default=list, blank=True)
    investment_verdict = models.CharField(max_length=100, default="Promising Trajectory")
    health_score = models.PositiveIntegerField(default=75)
    executive_summary = models.TextField(blank=True)
    
    key_strengths = models.JSONField(default=list, blank=True)
    critical_risks = models.JSONField(default=list, blank=True)
    actionable_recommendations = models.JSONField(default=list, blank=True)
    chart_insights = models.JSONField(default=dict, blank=True)
    
    analyzed_files_count = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"AI Verdict for {self.startup.name} ({self.health_score}/100)"

