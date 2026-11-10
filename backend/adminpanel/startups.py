"""Module 2 — Startups, 3 — Investments, 4 — Collaborations."""
from django.db.models import Case, Count, IntegerField, OuterRef, Q, Subquery, Sum, Value, When
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from audit.log import record
from core.admin_api import AdminAPIMixin
from moderation.models import Report
from notifications.services import notify
from startups.models import Application, CollaborationRole, Investment, Startup

from .common import note_from, require, truthy

# ------------------------------------------------------------------ startups


class AdminStartupSerializer(serializers.ModelSerializer):
    owner_name = serializers.ReadOnlyField(source='owner.name')
    owner_email = serializers.ReadOnlyField(source='owner.email')
    reviewed_by_name = serializers.ReadOnlyField(source='reviewed_by.name')
    open_reports = serializers.IntegerField(read_only=True)
    funding_pct = serializers.ReadOnlyField()

    class Meta:
        model = Startup
        fields = [
            'slug', 'name', 'tagline', 'owner', 'owner_name', 'owner_email', 'review_status', 'review_note',
            'reviewed_at', 'reviewed_by_name', 'featured', 'verified', 'status', 'goal', 'raised', 'funding_pct',
            'created_at', 'open_reports',
        ]


def _startups():
    open_reports = (
        Report.objects.filter(target_type=Report.STARTUP, status=Report.OPEN, target_id=OuterRef('slug'))
        .values('target_id').annotate(c=Count('pk')).values('c')[:1]
    )
    return Startup.objects.select_related('owner', 'reviewed_by').annotate(
        open_reports=Coalesce(Subquery(open_reports, output_field=IntegerField()), Value(0)),
    )


REVIEW_DECISIONS = {
    # decision: (new status, allowed from, owner message)
    'approve': (Startup.REVIEW_APPROVED, {Startup.REVIEW_PENDING, Startup.REVIEW_REJECTED},
                '{name} was approved and is now public.'),
    'reject': (Startup.REVIEW_REJECTED, {Startup.REVIEW_PENDING},
               "{name} wasn't approved: {note} Edit it and it will be reviewed again."),
    'suspend': (Startup.REVIEW_SUSPENDED, {Startup.REVIEW_APPROVED, Startup.REVIEW_PENDING},
                '{name} has been suspended and is hidden from the public: {note}'),
    'restore': (Startup.REVIEW_APPROVED, {Startup.REVIEW_SUSPENDED},
                '{name} has been restored and is public again.'),
}


class AdminStartupViewSet(AdminAPIMixin, viewsets.ReadOnlyModelViewSet):
    """Review, approve, reject, feature and suspend startups.

    Filters: ``q``, ``review_status``, ``featured`` (1|0), ``status`` (funding round).
    """

    admin_capability = 'startups.view'
    serializer_class = AdminStartupSerializer
    lookup_field = 'slug'

    def get_queryset(self):
        qs = _startups()
        p = self.request.query_params
        if p.get('q'):
            q = p['q'].strip()
            qs = qs.filter(Q(name__icontains=q) | Q(slug__icontains=q) | Q(owner__email__icontains=q))
        if p.get('review_status'):
            qs = qs.filter(review_status=p['review_status'])
        if p.get('featured') in ('1', '0'):
            qs = qs.filter(featured=p['featured'] == '1')
        if p.get('status'):
            qs = qs.filter(status=p['status'])
        # The review queue (pending) always comes first, then newest first.
        queue_first = Case(When(review_status=Startup.REVIEW_PENDING, then=0), default=1, output_field=IntegerField())
        return qs.order_by(queue_first, '-created_at')

    @action(detail=True, methods=['post'])
    def review(self, request, slug=None):
        """Body: ``decision`` (approve|reject|suspend|restore), ``note`` (required to reject/suspend)."""
        require(request, 'startups.manage')
        decision = request.data.get('decision')
        if decision not in REVIEW_DECISIONS:
            raise ValidationError({'decision': ['Choose approve, reject, suspend or restore.']})
        new_status, allowed_from, message = REVIEW_DECISIONS[decision]
        note = note_from(request, required=decision in ('reject', 'suspend'))
        startup = self.get_object()
        if startup.review_status not in allowed_from:
            raise ValidationError({'detail': f"Can't {decision} a startup that is {startup.get_review_status_display().lower()}."})
        old = startup.review_status
        startup.review_status = new_status
        startup.review_note = note
        startup.reviewed_at = timezone.now()
        startup.reviewed_by = request.user
        startup.save(update_fields=['review_status', 'review_note', 'reviewed_at', 'reviewed_by'])
        if new_status != Startup.REVIEW_APPROVED and startup.featured:
            Startup.objects.filter(pk=startup.pk).update(featured=False)
        record(f'admin.startup_{decision}', startup, review_status=[old, new_status], note=note)
        notify(
            startup.owner, message.format(name=startup.name, note=note),
            f'/dashboard/{startup.pk}', icon='flag',
            color='success' if new_status == Startup.REVIEW_APPROVED else 'warning',
        )
        return Response(AdminStartupSerializer(self.get_queryset().get(pk=startup.pk)).data)

    @action(detail=True, methods=['post'])
    def flags(self, request, slug=None):
        """Body: ``featured`` and/or ``verified`` (booleans)."""
        require(request, 'startups.manage')
        startup = self.get_object()
        changes = {}
        for field in ('featured', 'verified'):
            if field in request.data:
                value = truthy(request.data[field])
                if field == 'featured' and value and startup.review_status != Startup.REVIEW_APPROVED:
                    raise ValidationError({'featured': ['Only approved startups can be featured.']})
                if getattr(startup, field) != value:
                    changes[field] = [getattr(startup, field), value]
                    setattr(startup, field, value)
        if changes:
            startup.save(update_fields=list(changes))
            record('admin.startup_flags', startup, changes=changes)
        return Response(AdminStartupSerializer(self.get_queryset().get(pk=startup.pk)).data)


# ------------------------------------------------------------------ investments


class AdminInvestmentSerializer(serializers.ModelSerializer):
    investor_name = serializers.ReadOnlyField(source='investor.name')
    investor_email = serializers.ReadOnlyField(source='investor.email')
    startup_name = serializers.ReadOnlyField(source='startup.name')
    decided_by_name = serializers.ReadOnlyField(source='decided_by.name')

    class Meta:
        model = Investment
        fields = [
            'id', 'startup', 'startup_name', 'investor', 'investor_name', 'investor_email', 'amount', 'status',
            'created_at', 'updated_at', 'decided_at', 'decided_by_name', 'decision_note',
        ]


class AdminInvestmentViewSet(AdminAPIMixin, viewsets.ReadOnlyModelViewSet):
    """View requests, track decisions and monitor funding.

    Filters: ``q`` (investor or startup), ``status``, ``startup``, ``min_amount``, ``max_amount``.
    """

    admin_capability = 'investments.view'
    serializer_class = AdminInvestmentSerializer

    def get_queryset(self):
        qs = Investment.objects.select_related('investor', 'startup', 'decided_by')
        p = self.request.query_params
        if p.get('q'):
            q = p['q'].strip()
            qs = qs.filter(
                Q(investor__email__icontains=q) | Q(investor__first_name__icontains=q)
                | Q(investor__last_name__icontains=q) | Q(startup__name__icontains=q),
            )
        if p.get('status'):
            qs = qs.filter(status=p['status'])
        if p.get('startup'):
            qs = qs.filter(startup__slug=p['startup'])
        for param, lookup in (('min_amount', 'amount__gte'), ('max_amount', 'amount__lte')):
            if p.get(param, '').isdigit():
                qs = qs.filter(**{lookup: int(p[param])})
        return qs.order_by('-created_at', '-id')

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Totals by status and a per-startup funding monitor."""
        by_status = {
            row['status']: {'count': row['count'], 'amount': row['amount'] or 0}
            for row in Investment.objects.values('status').annotate(count=Count('pk'), amount=Sum('amount'))
        }
        counted = Q(investments__status__in=Investment.COUNTED_STATUSES)
        rounds = (
            Startup.objects.filter(goal__gt=0)
            .annotate(
                platform_raised=Sum('investments__amount', filter=counted),
                pending_amount=Sum('investments__amount', filter=Q(investments__status=Investment.PENDING)),
                pending_count=Count('investments', filter=Q(investments__status=Investment.PENDING)),
            )
            .order_by('-raised')[:50]
        )
        monitor = [{
            'slug': s.slug, 'name': s.name, 'status': s.status, 'goal': s.goal, 'raised': s.raised,
            'external_raised': s.external_raised, 'platform_raised': s.platform_raised or 0,
            'pending_amount': s.pending_amount or 0, 'pending_count': s.pending_count, 'funding_pct': s.funding_pct,
            # Should always be 0; anything else means `raised` drifted from real investments.
            'drift': s.raised - s.external_raised - (s.platform_raised or 0),
        } for s in rounds]
        return Response({'by_status': by_status, 'rounds': monitor})


# ------------------------------------------------------------------ collaborations


class AdminApplicationSerializer(serializers.ModelSerializer):
    applicant_name = serializers.ReadOnlyField(source='applicant.name')
    applicant_email = serializers.ReadOnlyField(source='applicant.email')
    startup_name = serializers.ReadOnlyField(source='startup.name')

    class Meta:
        model = Application
        fields = [
            'id', 'startup', 'startup_name', 'applicant', 'applicant_name', 'applicant_email', 'role',
            'name', 'email', 'link', 'message', 'status', 'created_at', 'decided_at',
        ]


class AdminCollaborationViewSet(AdminAPIMixin, viewsets.ReadOnlyModelViewSet):
    """Review collaboration applications and the opportunities (listings) behind them.

    Filters: ``q``, ``status``, ``startup``.
    """

    admin_capability = 'collaborations.view'
    serializer_class = AdminApplicationSerializer

    def get_queryset(self):
        qs = Application.objects.select_related('applicant', 'startup')
        p = self.request.query_params
        if p.get('q'):
            q = p['q'].strip()
            qs = qs.filter(
                Q(applicant__email__icontains=q) | Q(name__icontains=q) | Q(role__icontains=q)
                | Q(startup__name__icontains=q),
            )
        if p.get('status'):
            qs = qs.filter(status=p['status'])
        if p.get('startup'):
            qs = qs.filter(startup__slug=p['startup'])
        return qs.order_by('-created_at', '-id')

    @action(detail=False, methods=['get'])
    def listings(self, request):
        """Every collaboration opportunity with its applicant counts."""
        rows = (
            CollaborationRole.objects.select_related('startup')
            .annotate(
                applicants=Count('startup__applications', distinct=True),
                pending=Count('startup__applications', filter=Q(startup__applications__status='pending'), distinct=True),
            )
            .order_by('-is_open', '-updated_at')
        )
        q = request.query_params.get('q', '').strip()
        if q:
            rows = rows.filter(Q(role__icontains=q) | Q(startup__name__icontains=q))
        return Response([{
            'startup': r.startup_id, 'startup_name': r.startup.name, 'role': r.role, 'body': r.body,
            'is_open': r.is_open, 'updated_at': r.updated_at, 'applicants': r.applicants, 'pending': r.pending,
        } for r in rows[:200]])

    @action(detail=False, methods=['post'], url_path=r'listings/(?P<slug>[^/.]+)/close')
    def close_listing(self, request, slug=None):
        """Unpublish a listing that breaks the rules. Body: ``note`` (required)."""
        require(request, 'collaborations.manage')
        note = note_from(request, required=True)
        listing = CollaborationRole.objects.select_related('startup__owner').filter(startup_id=slug).first()
        if listing is None:
            raise ValidationError({'detail': 'That listing no longer exists.'})
        if listing.is_open:
            listing.is_open = False
            listing.save(update_fields=['is_open', 'updated_at'])
            record('admin.listing_closed', listing.startup, role=listing.role, note=note)
            notify(
                listing.startup.owner, f'Your "{listing.role}" listing was unpublished by our team: {note}',
                f'/dashboard/{slug}', icon='handshake', color='warning',
            )
        return Response({'startup': slug, 'is_open': False})
