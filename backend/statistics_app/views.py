import csv
import os
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from startups.models import Startup
from .models import StartupStatisticsReport
from .serializers import StartupStatisticsReportSerializer
from .services.ai_analyzer import analyze_with_deepseek
from .services.data_extractor import process_uploaded_file


class IsStartupOwnerPermission(permissions.BasePermission):
    """Enforces that only the creator/owner of the startup can access or modify its statistics."""

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        return obj.startup.owner == request.user


class StatisticsViewSet(viewsets.ModelViewSet):
    serializer_class = StartupStatisticsReportSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = StartupStatisticsReport.objects.filter(startup__owner=user)
        startup_slug = self.request.query_params.get('startup')
        if startup_slug:
            qs = qs.filter(startup__slug=startup_slug)
        return qs

    def create(self, request, *args, **kwargs):
        """Uploads a CSV or PDF file and computes baseline metrics."""
        startup_slug = request.data.get('startup_slug') or request.data.get('startup')
        if not startup_slug:
            return Response({'error': 'startup_slug is required.'}, status=status.HTTP_400_BAD_REQUEST)

        startup = get_object_or_404(Startup, slug=startup_slug)

        # Enforce that only the startup founder/owner can upload statistics
        if startup.owner != request.user:
            return Response(
                {'error': 'Permission denied. Only the founder who created this startup can upload statistics.'},
                status=status.HTTP_403_FORBIDDEN
            )

        upload_file = request.FILES.get('file')
        if not upload_file:
            return Response({'error': 'No file was uploaded.'}, status=status.HTTP_400_BAD_REQUEST)

        orig_name = upload_file.name
        ext = os.path.splitext(orig_name)[1].lower()
        if ext not in ['.csv', '.pdf']:
            return Response({'error': 'Invalid file format. Only CSV (.csv) and PDF (.pdf) files are supported.'},
                            status=status.HTTP_400_BAD_REQUEST)

        # Cap size at 10 MB
        if upload_file.size > 10 * 1024 * 1024:
            return Response({'error': 'File is too large. Maximum size is 10 MB.'},
                            status=status.HTTP_400_BAD_REQUEST)

        file_type = StartupStatisticsReport.FILE_CSV if ext == '.csv' else StartupStatisticsReport.FILE_PDF

        report = StartupStatisticsReport.objects.create(
            startup=startup,
            uploaded_by=request.user,
            file=upload_file,
            original_filename=orig_name,
            file_type=file_type,
            status=StartupStatisticsReport.STATUS_READY
        )

        # Process and calculate baseline metrics
        try:
            file_path = report.file.path
            metrics = process_uploaded_file(file_path)
            report.raw_summary = metrics
            report.save(update_fields=['raw_summary'])
        except Exception as e:
            report.status = StartupStatisticsReport.STATUS_FAILED
            report.ai_error = f"Error processing file: {str(e)}"
            report.save(update_fields=['status', 'ai_error'])
            return Response({
                'error': f"Failed to extract metrics from file: {str(e)}"
            }, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(report)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def analyze(self, request, pk=None):
        """Triggers DeepSeek AI analysis on the uploaded dataset."""
        report = self.get_object()

        # Enforce ownership check
        if report.startup.owner != request.user:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        report.status = StartupStatisticsReport.STATUS_ANALYZING
        report.save(update_fields=['status'])

        startup = report.startup
        try:
            ai_result = analyze_with_deepseek(
                raw_summary=report.raw_summary,
                startup_name=startup.name,
                startup_tagline=startup.tagline,
                startup_tags=startup.tags
            )
            report.ai_analysis = ai_result
            report.status = StartupStatisticsReport.STATUS_COMPLETED
            report.save(update_fields=['ai_analysis', 'status'])
        except Exception as e:
            report.status = StartupStatisticsReport.STATUS_FAILED
            report.ai_error = str(e)
            report.save(update_fields=['status', 'ai_error'])
            return Response({'error': f"AI Analysis failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        serializer = self.get_serializer(report)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='sample-csv', permission_classes=[permissions.AllowAny])
    def sample_csv(self, request):
        """Generates and serves a formatted sample CSV file for founders."""
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="forge_flight_sample_statistics.csv"'

        writer = csv.writer(response)
        writer.writerow(['date', 'customer_name', 'customer_email', 'customer_segment', 'sales_amount', 'cost_amount', 'category'])
        
        sample_data = [
            ['2026-01-10', 'Acme Corp', 'contact@acme.com', 'Enterprise', '12500.00', '3200.00', 'Software License'],
            ['2026-01-18', 'TechNova Labs', 'billing@technova.io', 'Mid-Market', '6400.00', '1800.00', 'Cloud Infrastructure'],
            ['2026-01-25', 'Sarah Jenkins', 's.jenkins@gmail.com', 'Prosumer', '1200.00', '350.00', 'Subscription'],
            ['2026-02-05', 'BioHealth Systems', 'finance@biohealth.org', 'Enterprise', '18000.00', '4900.00', 'Custom Deployment'],
            ['2026-02-14', 'GreenPulse Energy', 'ops@greenpulse.com', 'Mid-Market', '8200.00', '2100.00', 'Software License'],
            ['2026-02-22', 'Apex Dynamics', 'apex@dynamics.ai', 'Enterprise', '14500.00', '3800.00', 'Support SLA'],
            ['2026-03-02', 'Marcus Vance', 'mvance@startup.co', 'SMB', '2400.00', '600.00', 'Subscription'],
            ['2026-03-12', 'Quantix Analytics', 'admin@quantix.io', 'Enterprise', '22000.00', '5400.00', 'Data Processing'],
            ['2026-03-21', 'Elena Rostova', 'elena@designcraft.com', 'Prosumer', '1500.00', '400.00', 'Subscription'],
            ['2026-04-04', 'CloudStream Media', 'payables@cloudstream.net', 'Mid-Market', '9600.00', '2500.00', 'Cloud Infrastructure'],
            ['2026-04-18', 'Nexus Robotics', 'contact@nexusrobotics.org', 'Enterprise', '26500.00', '6800.00', 'Enterprise Bundle'],
            ['2026-04-29', 'David Chen', 'dchen@chenlaw.com', 'SMB', '3100.00', '750.00', 'Subscription'],
        ]
        
        for row in sample_data:
            writer.writerow(row)

        return response
