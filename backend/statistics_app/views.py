import csv
import os
import re
from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from startups.models import Startup
from .models import StartupStatisticsReport, StartupAIVerdict
from .serializers import StartupStatisticsReportSerializer, StartupAIVerdictSerializer
from .services.ai_analyzer import analyze_with_deepseek
from .services.data_extractor import process_uploaded_file, aggregate_startup_reports


def _safe_int(val, default=0):
    if val is None:
        return default
    if isinstance(val, (int, float)):
        return int(val)
    cleaned = re.sub(r'[^\d]', '', str(val).split('.')[0])
    try:
        return int(cleaned) if cleaned else default
    except (ValueError, TypeError):
        return default


def _safe_float(val, default=0.0):
    if val is None:
        return default
    if isinstance(val, (int, float)):
        return float(val)
    cleaned = re.sub(r'[^\d.]', '', str(val))
    try:
        return float(cleaned) if cleaned else default
    except (ValueError, TypeError):
        return default


class StatisticsViewSet(viewsets.ModelViewSet):
    serializer_class = StartupStatisticsReportSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'sample_csv', 'search_companies']:
            return [permissions.AllowAny()]
        if self.action == 'research':
            if self.request.method in permissions.SAFE_METHODS:
                return [permissions.AllowAny()]
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        startup_slug = self.request.query_params.get('startup') or self.request.query_params.get('startup_slug')
        user = self.request.user

        if self.action in ['destroy', 'update', 'partial_update']:
            return StartupStatisticsReport.objects.all()

        if startup_slug:
            # If startup is requested:
            # Owners see all their reports; public users see published reports
            startup = Startup.objects.filter(slug__iexact=startup_slug).first()
            if startup and user.is_authenticated and startup.owner == user:
                return StartupStatisticsReport.objects.filter(startup=startup)
            return StartupStatisticsReport.objects.filter(startup__slug__iexact=startup_slug, is_published=True)

        if user.is_authenticated:
            return StartupStatisticsReport.objects.filter(startup__owner=user)
        return StartupStatisticsReport.objects.filter(is_published=True)

    def create(self, request, *args, **kwargs):
        """Uploads a CSV or PDF file and computes baseline metrics. Restricted to startup owner."""
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

        if startup.review_status != Startup.REVIEW_APPROVED:
            return Response(
                {'error': 'Financial statements and research reports cannot be published until your startup is approved by an administrator.'},
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
        reporting_period = request.data.get('reporting_period', '').strip()

        report = StartupStatisticsReport.objects.create(
            startup=startup,
            uploaded_by=request.user,
            file=upload_file,
            original_filename=orig_name,
            file_type=file_type,
            reporting_period=reporting_period,
            is_published=True,
            status=StartupStatisticsReport.STATUS_READY
        )

        # Process and calculate baseline metrics
        try:
            with report.file.open('rb') as uploaded:
                metrics = process_uploaded_file(uploaded, filename=orig_name)
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

    def destroy(self, request, *args, **kwargs):
        """Allows startup owners to remove an uploaded financial report."""
        instance = self.get_object()
        if instance.startup.owner != request.user:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get', 'post'], url_path='research')
    def research(self, request):
        """
        Universal AI Research & Valuation Endpoint.
        Accessible to EVERYONE (investors, users, founders).
        Accepts startup slug or company name, aggregates all published files,
        and generates comprehensive valuation, future projections, and investment verdict.
        """
        startup_identifier = (
            request.data.get('startup') or
            request.data.get('startup_slug') or
            request.data.get('company_name') or
            request.query_params.get('startup') or
            request.query_params.get('company')
        )

        if not startup_identifier:
            return Response({'error': 'A startup slug or company name is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Look up startup by exact slug, name, or case-insensitive match
        startup = Startup.objects.filter(slug=startup_identifier).first()
        if not startup:
            startup = Startup.objects.filter(name__iexact=startup_identifier).first()
        if not startup:
            startup = Startup.objects.filter(name__icontains=startup_identifier).first()

        if not startup:
            return Response({'error': f"Startup '{startup_identifier}' not found on Forge & Flight."}, status=status.HTTP_404_NOT_FOUND)

        from accounts.models import Role
        if startup.review_status != Startup.REVIEW_APPROVED:
            if not request.user.is_authenticated or (startup.owner_id != request.user.id and not request.user.has_role(Role.ADMIN)):
                return Response({'error': f"Startup '{startup_identifier}' not found on Forge & Flight."}, status=status.HTTP_404_NOT_FOUND)

        # Fetch published reports for this startup
        published_reports = list(StartupStatisticsReport.objects.filter(startup=startup, is_published=True))
        aggregated_summary = aggregate_startup_reports(published_reports)

        # Generate fresh AI analysis or retrieve cached
        force_refresh = request.method == 'POST' or request.query_params.get('refresh') == 'true'
        cached_verdict = StartupAIVerdict.objects.filter(startup=startup).first()

        if not cached_verdict or force_refresh or len(published_reports) != (cached_verdict.analyzed_files_count if cached_verdict else 0):
            try:
                ai_data = analyze_with_deepseek(
                    raw_summary=aggregated_summary,
                    startup_name=startup.name,
                    startup_tagline=startup.tagline,
                    startup_tags=startup.tags
                )

                val_data = ai_data.get('valuation_estimate', {})
                growth_data = ai_data.get('business_growth_percentage', {})

                val_low_val = _safe_int(val_data.get('low'), 250000)
                val_high_val = _safe_int(val_data.get('high'), 500000)
                if val_high_val <= val_low_val:
                    val_high_val = max(val_low_val + 50000, int(val_low_val * 1.4))

                verdict_obj, _ = StartupAIVerdict.objects.update_or_create(
                    startup=startup,
                    defaults={
                        'valuation_low': val_low_val,
                        'valuation_high': val_high_val,
                        'valuation_multiple': str(val_data.get('multiple') or '4x - 6x ARR'),
                        'valuation_rationale': str(val_data.get('rationale') or ''),
                        'historical_mom_growth': _safe_float(growth_data.get('historical_mom_growth'), aggregated_summary.get('mom_growth_rate', 0.0)),
                        'projected_annual_growth': _safe_float(growth_data.get('projected_annual_growth'), 25.0),
                        'growth_stage': str(growth_data.get('growth_stage') or 'Early Stage'),
                        'future_projections': ai_data.get('future_projections') or [],
                        'investment_verdict': str(ai_data.get('investment_verdict') or 'Promising Trajectory'),
                        'health_score': _safe_int(ai_data.get('health_score'), 75),
                        'executive_summary': str(ai_data.get('executive_summary') or ''),
                        'key_strengths': ai_data.get('key_strengths') or [],
                        'critical_risks': ai_data.get('critical_risks') or [],
                        'actionable_recommendations': ai_data.get('actionable_recommendations') or [],
                        'chart_insights': ai_data.get('chart_insights') or {},
                        'analyzed_files_count': len(published_reports),
                    }
                )
                cached_verdict = verdict_obj
            except Exception as e:
                return Response({'error': f"Failed to generate AI verdict: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        verdict_serializer = StartupAIVerdictSerializer(cached_verdict, context={'request': request})
        reports_serializer = StartupStatisticsReportSerializer(published_reports, many=True, context={'request': request})

        return Response({
            'startup': {
                'slug': startup.slug,
                'name': startup.name,
                'initials': startup.initials,
                'tagline': startup.tagline,
                'tags': startup.tags,
                'verified': startup.verified,
                'status': startup.status,
                'goal': startup.goal,
                'raised': startup.raised,
                'funding_pct': startup.funding_pct,
            },
            'verdict': verdict_serializer.data,
            'aggregated_summary': aggregated_summary,
            'published_reports': reports_serializer.data,
        })

    @action(detail=False, methods=['get'], url_path='search-companies')
    def search_companies(self, request):
        """
        Search companies on Forge & Flight for the universal AI Research Hub.
        Returns matching startups along with indication of published financial reports.
        """
        q = request.query_params.get('q', '').strip()
        qs = Startup.objects.filter(review_status=Startup.REVIEW_APPROVED)
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(tagline__icontains=q) | Q(slug__icontains=q))

        results = []
        for s in qs[:15]:
            has_reports = s.statistics_reports.filter(is_published=True).exists()
            reports_count = s.statistics_reports.filter(is_published=True).count()
            verdict = getattr(s, 'ai_verdict', None)
            results.append({
                'slug': s.slug,
                'name': s.name,
                'initials': s.initials,
                'tagline': s.tagline,
                'tags': s.tags,
                'verified': s.verified,
                'has_reports': has_reports,
                'reports_count': reports_count,
                'valuation_high': verdict.valuation_high if verdict else 0,
                'health_score': verdict.health_score if verdict else None,
                'investment_verdict': verdict.investment_verdict if verdict else None,
            })

        return Response(results)

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
