from rest_framework import serializers
from .models import StartupStatisticsReport


class StartupStatisticsReportSerializer(serializers.ModelSerializer):
    startup_name = serializers.CharField(source='startup.name', read_only=True)
    startup_slug = serializers.CharField(source='startup.slug', read_only=True)
    uploaded_by_name = serializers.CharField(source='uploaded_by.name', read_only=True)

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
            'original_filename',
            'file_type',
            'raw_summary',
            'ai_analysis',
            'status',
            'ai_error',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'uploaded_by', 'status', 'ai_error', 'created_at', 'updated_at']
