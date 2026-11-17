from rest_framework import serializers
from .models import StartupStatisticsReport, StartupAIVerdict


class StartupStatisticsReportSerializer(serializers.ModelSerializer):
    startup_name = serializers.CharField(source='startup.name', read_only=True)
    startup_slug = serializers.CharField(source='startup.slug', read_only=True)
    uploaded_by_name = serializers.CharField(source='uploaded_by.name', read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = StartupStatisticsReport
        fields = [
            'id',
            'startup',
            'startup_slug',
            'startup_name',
            'uploaded_by',
            'uploaded_by_name',
            'file',
            'file_url',
            'original_filename',
            'file_type',
            'is_published',
            'reporting_period',
            'raw_summary',
            'ai_analysis',
            'status',
            'ai_error',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'uploaded_by', 'status', 'ai_error', 'created_at', 'updated_at']

    def get_file_url(self, obj):
        if obj.file:
            try:
                request = self.context.get('request')
                return request.build_absolute_uri(obj.file.url) if request else obj.file.url
            except Exception:
                return obj.file.url
        return None


class StartupAIVerdictSerializer(serializers.ModelSerializer):
    startup_name = serializers.CharField(source='startup.name', read_only=True)
    startup_slug = serializers.CharField(source='startup.slug', read_only=True)

    class Meta:
        model = StartupAIVerdict
        fields = [
            'id',
            'startup',
            'startup_slug',
            'startup_name',
            'valuation_low',
            'valuation_high',
            'valuation_multiple',
            'valuation_rationale',
            'historical_mom_growth',
            'projected_annual_growth',
            'growth_stage',
            'future_projections',
            'investment_verdict',
            'health_score',
            'executive_summary',
            'key_strengths',
            'critical_risks',
            'actionable_recommendations',
            'chart_insights',
            'analyzed_files_count',
            'updated_at',
        ]
        read_only_fields = ['id', 'updated_at']
