"""Module 7 — Announcements, 8 — Analytics, 11 — System Settings."""
import csv
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDay, TruncWeek
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import mixins, serializers, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import ADMIN_ROLES
from audit.log import record
from core.admin_api import AdminAPIMixin
from core.models import SiteSettings
from notifications.models import Announcement, Notification
from notifications.services import COLORS
from startups.models import Application, Investment, Startup

from .capabilities import has_capability

User = get_user_model()

# ------------------------------------------------------------------ announcements

MAX_DIRECT_RECIPIENTS = 500


def audience_queryset(audience, user_ids=None):
    users = User.objects.filter(is_active=True)
    if audience == 'all':
        return users
    if audience == 'founders':
        return users.filter(startups__isnull=False).distinct()
    if audience == 'investors':
        return users.filter(investments__isnull=False).distinct()
    if audience == 'collaborators':
        return users.filter(applications__isnull=False).distinct()
    if audience == 'staff':
        return users.filter(Q(role__in=ADMIN_ROLES) | Q(is_superuser=True))
    if audience == 'users':
        return users.filter(pk__in=user_ids or [])
    raise ValidationError({'audience': ['Choose who should receive this.']})


class AnnouncementSerializer(serializers.ModelSerializer):
    sender_name = serializers.ReadOnlyField(source='sender.name')
    user_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)

    class Meta:
        model = Announcement
        fields = ['id', 'text', 'link', 'audience', 'user_ids', 'recipient_count', 'sender_name', 'created_at']
        read_only_fields = ['recipient_count', 'created_at']

    def validate_link(self, link):
        link = (link or '').strip()
        if link and not link.startswith('/'):
            raise serializers.ValidationError('Use a link inside the app, starting with "/" (e.g. /feed).')
        return link

    def validate(self, attrs):
        if attrs['audience'] == 'users':
            ids = attrs.get('user_ids') or []
            if not ids:
                raise serializers.ValidationError({'user_ids': ['Pick at least one person.']})
            if len(ids) > MAX_DIRECT_RECIPIENTS:
                raise serializers.ValidationError({'user_ids': [f'At most {MAX_DIRECT_RECIPIENTS} people at once.']})
        return attrs


class AdminAnnouncementViewSet(AdminAPIMixin, mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    """Send announcements and targeted notifications; list what was sent."""

    admin_capability = 'notifications.send'
    serializer_class = AnnouncementSerializer
    queryset = Announcement.objects.select_related('sender')

    def perform_create(self, serializer):
        data = serializer.validated_data
        recipients = list(audience_queryset(data['audience'], data.get('user_ids')).values_list('pk', flat=True))
        if not recipients:
            raise ValidationError({'audience': ['Nobody matches this audience yet.']})
        with transaction.atomic():
            announcement = Announcement.objects.create(
                sender=self.request.user, text=data['text'], link=data.get('link', ''),
                audience=data['audience'], recipient_count=len(recipients),
            )
            Notification.objects.bulk_create(
                [Notification(recipient_id=pk, text=data['text'], link=data.get('link') or '/notifications',
                              icon='bell', color=COLORS['accent']) for pk in recipients],
                batch_size=1000,
            )
        serializer.instance = announcement
        record('admin.announcement_sent', announcement, audience=data['audience'], recipients=len(recipients))


class AnnouncementPreviewView(AdminAPIMixin, APIView):
    """How many people an audience reaches, before sending."""

    admin_capability = 'notifications.send'

    def get(self, request):
        ids = [int(i) for i in request.query_params.get('user_ids', '').split(',') if i.strip().isdigit()]
        return Response({'recipients': audience_queryset(request.query_params.get('audience'), ids).count()})


# ------------------------------------------------------------------ analytics


def _date_range(request):
    """``from``/``to`` (YYYY-MM-DD), default the last 30 days; at most two years."""
    today = timezone.localdate()
    try:
        end = date.fromisoformat(request.query_params.get('to') or today.isoformat())
        start = date.fromisoformat(request.query_params.get('from') or (end - timedelta(days=29)).isoformat())
    except ValueError:
        raise ValidationError({'detail': 'Dates must look like 2026-01-31.'})
    if start > end:
        raise ValidationError({'detail': '"From" must be before "to".'})
    if (end - start).days > 731:
        raise ValidationError({'detail': 'Pick a range of two years or less.'})
    return start, end


def _bucketed(qs, field, start, end, value=None):
    span = (end - start).days
    trunc = TruncDay if span <= 62 else TruncWeek
    rows = (
        qs.filter(**{f'{field}__date__gte': start, f'{field}__date__lte': end})
        .annotate(bucket=trunc(field)).values('bucket').annotate(v=value or Count('pk'))
    )
    return {r['bucket'].date().isoformat(): r['v'] or 0 for r in rows if r['bucket']}, ('day' if trunc is TruncDay else 'week')


def _buckets(start, end, unit):
    step = timedelta(days=1 if unit == 'day' else 7)
    cur = start if unit == 'day' else start - timedelta(days=start.weekday())
    out = []
    while cur <= end:
        out.append(cur.isoformat())
        cur += step
    return out


class AdminAnalyticsView(AdminAPIMixin, APIView):
    """Platform statistics for a date range (``from``, ``to``)."""

    admin_capability = 'analytics.view'

    def get(self, request):
        start, end = _date_range(request)
        in_range = {'created_at__date__gte': start, 'created_at__date__lte': end}
        investments = Investment.objects.filter(**in_range)
        decided = Investment.objects.filter(decided_at__date__gte=start, decided_at__date__lte=end)
        accepted = decided.filter(status__in=Investment.COUNTED_STATUSES)
        apps = Application.objects.filter(**in_range)
        decided_apps = apps.exclude(status__in=(Application.PENDING, Application.WITHDRAWN))
        totals = {
            'new_users': User.objects.filter(date_joined__date__gte=start, date_joined__date__lte=end).count(),
            'new_startups': Startup.objects.filter(**in_range).count(),
            'investment_requests': investments.count(),
            'investment_requested_amount': investments.aggregate(s=Sum('amount'))['s'] or 0,
            'investments_accepted': accepted.count(),
            'investment_accepted_amount': accepted.aggregate(s=Sum('amount'))['s'] or 0,
            'investments_rejected': decided.filter(status=Investment.REJECTED).count(),
            'applications': apps.count(),
            'applications_accepted': apps.filter(status=Application.ACCEPTED).count(),
        }
        decided_inv = totals['investments_accepted'] + totals['investments_rejected']
        totals['investment_acceptance_rate'] = round(100 * totals['investments_accepted'] / decided_inv) if decided_inv else None
        totals['application_acceptance_rate'] = (
            round(100 * totals['applications_accepted'] / decided_apps.count()) if decided_apps.count() else None
        )

        users_series, unit = _bucketed(User.objects.all(), 'date_joined', start, end)
        startups_series, _ = _bucketed(Startup.objects.all(), 'created_at', start, end)
        requests_series, _ = _bucketed(Investment.objects.all(), 'created_at', start, end)
        accepted_series, _ = _bucketed(
            Investment.objects.filter(status__in=Investment.COUNTED_STATUSES), 'decided_at', start, end, Sum('amount'),
        )
        labels = _buckets(start, end, unit)
        top = (
            Startup.objects.filter(review_status=Startup.REVIEW_APPROVED)
            .annotate(followers=Count('followed_by', distinct=True))
            .order_by('-raised')[:10]
        )
        return Response({
            'from': start.isoformat(), 'to': end.isoformat(), 'unit': unit, 'totals': totals,
            'series': {
                'labels': labels,
                'new_users': [users_series.get(d, 0) for d in labels],
                'new_startups': [startups_series.get(d, 0) for d in labels],
                'investment_requests': [requests_series.get(d, 0) for d in labels],
                'investment_accepted_amount': [accepted_series.get(d, 0) for d in labels],
            },
            'top_startups': [
                {'slug': s.slug, 'name': s.name, 'raised': s.raised, 'goal': s.goal, 'followers': s.followers}
                for s in top
            ],
        })


def _safe(value):
    """Stop spreadsheet apps from running cell text as a formula (CSV injection)."""
    text = '' if value is None else str(value)
    return "'" + text if text[:1] in ('=', '+', '-', '@', '\t', '\r') else text


EXPORTS = {
    # dataset: (capability needed, header, rows(start, end))
    'users': ('users.view', ['id', 'name', 'email', 'role', 'active', 'joined', 'last_login'], lambda s, e: (
        [u.pk, u.name, u.email, u.role, u.is_active, u.date_joined.isoformat(), u.last_login.isoformat() if u.last_login else '']
        for u in User.objects.filter(date_joined__date__gte=s, date_joined__date__lte=e).order_by('date_joined')
    )),
    'startups': ('startups.view', ['slug', 'name', 'owner_email', 'review_status', 'round', 'goal', 'raised', 'created'], lambda s, e: (
        [x.slug, x.name, x.owner.email, x.review_status, x.status, x.goal, x.raised, x.created_at.isoformat()]
        for x in Startup.objects.select_related('owner').filter(created_at__date__gte=s, created_at__date__lte=e).order_by('created_at')
    )),
    'investments': ('investments.view', ['id', 'startup', 'investor_email', 'amount', 'status', 'requested', 'decided', 'note'], lambda s, e: (
        [i.pk, i.startup_id, i.investor.email, i.amount, i.status, i.created_at.isoformat(),
         i.decided_at.isoformat() if i.decided_at else '', i.decision_note]
        for i in Investment.objects.select_related('investor').filter(created_at__date__gte=s, created_at__date__lte=e).order_by('created_at')
    )),
    'applications': ('collaborations.view', ['id', 'startup', 'applicant_email', 'role', 'status', 'applied', 'decided'], lambda s, e: (
        [a.pk, a.startup_id, a.applicant.email, a.role, a.status, a.created_at.isoformat(),
         a.decided_at.isoformat() if a.decided_at else '']
        for a in Application.objects.select_related('applicant').filter(created_at__date__gte=s, created_at__date__lte=e).order_by('created_at')
    )),
}


class AdminAnalyticsExportView(AdminAPIMixin, APIView):
    """Download a dataset as CSV: ``dataset``, ``from``, ``to``.

    Needs analytics access *and* access to that dataset's module.
    """

    admin_capability = 'analytics.view'

    def get(self, request):
        dataset = request.query_params.get('dataset')
        if dataset not in EXPORTS:
            raise ValidationError({'dataset': [f'Choose one of: {", ".join(EXPORTS)}.']})
        capability, header, rows = EXPORTS[dataset]
        if not has_capability(request.user, capability):
            return Response({'detail': "Your role can't export this dataset."}, status=403)
        start, end = _date_range(request)
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="forge-flight-{dataset}-{start}-to-{end}.csv"'
        response.write('﻿')  # so Excel reads UTF-8 names correctly
        writer = csv.writer(response)
        writer.writerow(header)
        count = 0
        for row in rows(start, end):
            writer.writerow([_safe(v) for v in row])
            count += 1
        record('admin.export', dataset=dataset, rows=count, range=[start.isoformat(), end.isoformat()])
        return response


# ------------------------------------------------------------------ system settings


class SiteSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteSettings
        fields = ['registration_open', 'google_signin_enabled', 'require_startup_approval', 'site_banner', 'updated_at']
        read_only_fields = ['updated_at']


class AdminSettingsView(AdminAPIMixin, APIView):
    """Platform configuration and security switches (super admins)."""

    admin_capability = 'settings.manage'

    def get(self, request):
        data = SiteSettingsSerializer(SiteSettings.current()).data
        from django.conf import settings as conf

        # Read-only security facts so admins can see how the platform is configured.
        data['security'] = {
            'debug': conf.DEBUG,
            'login_max_failures': conf.LOGIN_MAX_FAILURES,
            'login_lockout_minutes': conf.LOGIN_LOCKOUT_SECONDS // 60,
            'auth_rate_limit': conf.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['auth'],
            'session_days': conf.SESSION_COOKIE_AGE // 86400,
            'secure_cookies': conf.SESSION_COOKIE_SECURE,
            'google_client_configured': bool(conf.GOOGLE_OAUTH_CLIENT_ID),
        }
        return Response(data)

    def patch(self, request):
        current, _ = SiteSettings.objects.get_or_create(pk=1)
        serializer = SiteSettingsSerializer(current, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        before = SiteSettingsSerializer(current).data
        obj = serializer.save()
        changes = {k: [before[k], v] for k, v in SiteSettingsSerializer(obj).data.items() if k != 'updated_at' and before.get(k) != v}
        if changes:
            record('admin.settings_changed', obj, changes=changes)
        return self.get(request)
