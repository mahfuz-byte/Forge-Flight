"""Admin panel API (Phase 5): who am I, dashboard, activity log.

Everything here lives under /api/admin/ and inherits ``AdminAPIMixin``, so
regular users get 403 before any query runs.
"""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework import serializers, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from audit.models import AuditLog
from core.admin_api import AdminAPIMixin
from moderation.models import Report
from startups.models import Application, Investment, Startup

from .capabilities import ROLE_SUMMARIES, capabilities_for

User = get_user_model()

ACTIVE_WINDOW_DAYS = 30
CHART_MONTHS = 12


class AdminMeView(AdminAPIMixin, APIView):
    """The signed-in admin's role and capabilities, for building navigation."""

    def get(self, request):
        user = request.user
        role = 'super_admin' if user.is_superuser else user.role
        return Response({
            'id': user.id,
            'name': user.name,
            'email': user.email,
            'role': role,
            'role_label': dict(User._meta.get_field('role').choices).get(role, role),
            'role_summary': ROLE_SUMMARIES.get(role, ''),
            'capabilities': sorted(capabilities_for(user)),
        })


def _month_starts(n):
    """The first day of each of the last ``n`` months, oldest first."""
    today = timezone.localdate().replace(day=1)
    months = []
    y, m = today.year, today.month
    for _ in range(n):
        months.append((y, m))
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return list(reversed(months))


def _monthly(qs, date_field, value=None):
    """{(year, month): value} for a queryset, bucketed by month."""
    since = timezone.now() - timedelta(days=31 * CHART_MONTHS)
    rows = (
        qs.filter(**{f'{date_field}__gte': since})
        .annotate(month=TruncMonth(date_field))
        .values('month')
        .annotate(v=value or Count('pk'))
    )
    return {(r['month'].year, r['month'].month): r['v'] or 0 for r in rows if r['month']}


def _series(months, data):
    return [data.get(key, 0) for key in months]


class AdminDashboardView(AdminAPIMixin, APIView):
    """Headline numbers, growth charts and recent activity (Phase 5.3)."""

    admin_capability = 'dashboard.view'

    def get(self, request):
        now = timezone.now()
        counted = Q(status__in=Investment.COUNTED_STATUSES)
        inv = Investment.objects.aggregate(
            pending_count=Count('pk', filter=Q(status=Investment.PENDING)),
            pending_amount=Sum('amount', filter=Q(status=Investment.PENDING)),
            accepted_count=Count('pk', filter=counted),
            accepted_amount=Sum('amount', filter=counted),
        )
        stats = {
            'total_users': User.objects.count(),
            'active_users': User.objects.filter(
                is_active=True, last_login__gte=now - timedelta(days=ACTIVE_WINDOW_DAYS),
            ).count(),
            'suspended_users': User.objects.filter(is_active=False).count(),
            'total_startups': Startup.objects.count(),
            # Until the approval workflow (Phase 6) exists, "pending approval"
            # means a startup the team hasn't verified yet.
            'pending_startup_approvals': Startup.objects.filter(verified=False).count(),
            'investment_requests': inv['pending_count'],
            'investment_requests_amount': inv['pending_amount'] or 0,
            'accepted_investments': inv['accepted_count'],
            'accepted_investments_amount': inv['accepted_amount'] or 0,
            'pending_collaborations': Application.objects.filter(status=Application.PENDING).count(),
            'reported_content': Report.objects.filter(status=Report.OPEN).count(),
            'active_window_days': ACTIVE_WINDOW_DAYS,
        }

        months = _month_starts(CHART_MONTHS)
        charts = {
            'months': [f'{y}-{m:02d}' for y, m in months],
            'user_growth': _series(months, _monthly(User.objects.all(), 'date_joined')),
            'startup_growth': _series(months, _monthly(Startup.objects.all(), 'created_at')),
            'investment_requests': _series(months, _monthly(Investment.objects.all(), 'created_at')),
            'investment_accepted_amount': _series(
                months, _monthly(Investment.objects.filter(counted), 'decided_at', Sum('amount')),
            ),
        }
        return Response({'stats': stats, 'charts': charts, 'recent_activity': recent_activity()})


def recent_activity(limit=15):
    """The latest platform events across models, newest first."""
    events = []
    for u in User.objects.order_by('-date_joined')[:limit]:
        events.append({'type': 'user', 'at': u.date_joined, 'text': f'{u.name} joined', 'link': ''})
    for s in Startup.objects.select_related('owner').order_by('-created_at')[:limit]:
        events.append({
            'type': 'startup', 'at': s.created_at, 'text': f'{s.owner.name} created {s.name}',
            'link': f'/profile/{s.pk}',
        })
    for i in Investment.objects.select_related('investor', 'startup').order_by('-created_at')[:limit]:
        events.append({
            'type': 'investment', 'at': i.created_at,
            'text': f'{i.investor.name} requested ${i.amount:,} for {i.startup.name} ({i.status})',
            'link': f'/profile/{i.startup_id}',
        })
    for a in Application.objects.select_related('applicant', 'startup').order_by('-created_at')[:limit]:
        events.append({
            'type': 'application', 'at': a.created_at,
            'text': f'{a.applicant.name} applied for {a.role or "a role"} at {a.startup.name} ({a.status})',
            'link': f'/profile/{a.startup_id}',
        })
    for r in Report.objects.order_by('-created_at')[:limit]:
        events.append({
            'type': 'report', 'at': r.created_at,
            'text': f'{r.get_target_type_display()} reported for {r.get_reason_display().lower()}: {r.target_repr}',
            'link': '',
        })
    events.sort(key=lambda e: e['at'], reverse=True)
    return events[:limit]


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = [
            'id', 'created_at', 'actor', 'actor_email', 'actor_role', 'action',
            'target_type', 'target_id', 'target_repr', 'data', 'ip',
        ]


class AdminActivityViewSet(AdminAPIMixin, viewsets.ReadOnlyModelViewSet):
    """The audit trail as a server-paginated, filterable table.

    Filters: ``q`` (actor email, action or target), ``action`` (prefix, e.g.
    ``auth.``), ``actor_role``, ``since`` / ``until`` (YYYY-MM-DD).
    """

    admin_capability = 'activity.view'
    serializer_class = AuditLogSerializer

    def get_queryset(self):
        qs = AuditLog.objects.all()
        p = self.request.query_params
        if p.get('q'):
            q = p['q'].strip()
            qs = qs.filter(Q(actor_email__icontains=q) | Q(action__icontains=q) | Q(target_repr__icontains=q))
        if p.get('action'):
            qs = qs.filter(action__startswith=p['action'])
        if p.get('actor_role'):
            qs = qs.filter(actor_role=p['actor_role'])
        if p.get('since'):
            qs = qs.filter(created_at__date__gte=p['since'])
        if p.get('until'):
            qs = qs.filter(created_at__date__lte=p['until'])
        return qs.order_by('-created_at', '-id')
