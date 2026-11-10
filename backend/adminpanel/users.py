"""Module 1 — User Management, and module 9 — Admin Management."""
from django.contrib.auth import get_user_model
from django.db.models import Count, Exists, OuterRef, Q, Sum
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import ADMIN_ROLES, Role, SocialAccount
from audit.log import record
from core.admin_api import AdminAPIMixin
from moderation.models import Report
from notifications.services import notify
from startups.models import Investment

from .capabilities import CAPABILITIES, ROLE_SUMMARIES
from .common import note_from, require

User = get_user_model()


class AdminUserSerializer(serializers.ModelSerializer):
    name = serializers.ReadOnlyField()
    startups_count = serializers.IntegerField(read_only=True)
    google_linked = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'name', 'email', 'slug', 'role', 'is_active', 'is_superuser', 'email_verified',
            'date_joined', 'last_login', 'startups_count', 'google_linked',
        ]


def _user_queryset():
    return User.objects.annotate(
        startups_count=Count('startups', distinct=True),
        google_linked=Exists(SocialAccount.objects.filter(user=OuterRef('pk'))),
    )


def _outranks_or_403(actor, target):
    """Only super admins may act on staff accounts; nobody acts on themselves here."""
    if target.pk == actor.pk:
        raise PermissionDenied("You can't change your own account from the admin panel.")
    is_staff_target = target.is_superuser or target.role in ADMIN_ROLES
    if is_staff_target and not (actor.is_superuser or actor.role == Role.SUPER_ADMIN):
        raise PermissionDenied('Only a super admin can change another staff account.')


class AdminUserViewSet(AdminAPIMixin, viewsets.ReadOnlyModelViewSet):
    """Search, view, suspend and reactivate members.

    Filters: ``q`` (name/email), ``role``, ``status`` (active|suspended), ``verified`` (1|0).
    """

    admin_capability = 'users.view'
    serializer_class = AdminUserSerializer

    def get_queryset(self):
        qs = _user_queryset()
        p = self.request.query_params
        if p.get('q'):
            q = p['q'].strip()
            qs = qs.filter(Q(email__icontains=q) | Q(first_name__icontains=q) | Q(last_name__icontains=q))
        if p.get('role'):
            qs = qs.filter(role=p['role'])
        if p.get('status') == 'active':
            qs = qs.filter(is_active=True)
        elif p.get('status') == 'suspended':
            qs = qs.filter(is_active=False)
        if p.get('verified') in ('1', '0'):
            qs = qs.filter(email_verified=p['verified'] == '1')
        return qs.order_by('-date_joined', '-id')

    def retrieve(self, request, *args, **kwargs):
        user = self.get_object()
        data = AdminUserSerializer(user).data
        inv = Investment.objects.filter(investor=user).aggregate(
            count=Count('pk'), accepted=Sum('amount', filter=Q(status__in=Investment.COUNTED_STATUSES)),
        )
        data.update({
            'startups': list(user.startups.values('slug', 'name', 'review_status', 'status')),
            'investments_count': inv['count'],
            'investments_accepted_amount': inv['accepted'] or 0,
            'applications_count': user.applications.count(),
            'posts_count': user.posts.count(),
            'open_reports_against': Report.objects.filter(
                target_type=Report.USER, target_id=str(user.pk), status=Report.OPEN,
            ).count(),
            'location': user.location,
            'headline': user.headline,
        })
        return Response(data)

    @action(detail=True, methods=['post'])
    def suspend(self, request, pk=None):
        require(request, 'users.manage')
        user = self.get_object()
        _outranks_or_403(request.user, user)
        reason = note_from(request, required=True, field='reason')
        if not user.is_active:
            raise ValidationError({'detail': 'This account is already suspended.'})
        user.is_active = False
        user.save(update_fields=['is_active'])  # also audit-logged as user.deactivated
        record('admin.user_suspended', user, reason=reason)
        # Existing sessions stop working on the next request: Django refuses inactive users.
        return Response(AdminUserSerializer(_user_queryset().get(pk=user.pk)).data)

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        require(request, 'users.manage')
        user = self.get_object()
        _outranks_or_403(request.user, user)
        if user.is_active:
            raise ValidationError({'detail': 'This account is already active.'})
        user.is_active = True
        user.save(update_fields=['is_active'])
        record('admin.user_reactivated', user, reason=note_from(request, field='reason'))
        notify(user, 'Your Forge & Flight account has been reactivated.', '/feed', icon='check', color='success')
        return Response(AdminUserSerializer(_user_queryset().get(pk=user.pk)).data)


# ------------------------------------------------------------------ admins


class AdminRolesView(AdminAPIMixin, APIView):
    """Which capabilities each role holds (read-only matrix for the Admins page)."""

    admin_capability = 'admins.manage'

    def get(self, request):
        roles = []
        for value, label in Role.choices:
            if value == Role.USER:
                continue
            caps = sorted(CAPABILITIES) if value == Role.SUPER_ADMIN else sorted(
                c for c, holders in CAPABILITIES.items() if value in holders
            )
            roles.append({'role': value, 'label': label, 'summary': ROLE_SUMMARIES.get(value, ''), 'capabilities': caps})
        return Response({'roles': roles, 'capabilities': sorted(CAPABILITIES)})


class AdminStaffViewSet(AdminAPIMixin, viewsets.ReadOnlyModelViewSet):
    """Staff accounts and role assignment (super admins only)."""

    admin_capability = 'admins.manage'
    serializer_class = AdminUserSerializer

    def get_queryset(self):
        return _user_queryset().filter(Q(role__in=ADMIN_ROLES) | Q(is_superuser=True)).order_by('role', 'email')

    @action(detail=False, methods=['post'], url_path='set-role')
    def set_role(self, request):
        """Give someone a role (or ``user`` to remove staff access). Body: ``email`` or ``user_id``, ``role``."""
        role = request.data.get('role')
        if role not in Role.values:
            raise ValidationError({'role': ['Choose a valid role.']})
        lookup = {'pk': request.data['user_id']} if request.data.get('user_id') else {
            'email__iexact': str(request.data.get('email') or '').strip(),
        }
        target = User.objects.filter(**lookup).first()
        if target is None:
            raise ValidationError({'email': ['No account with that email.']})
        if target.pk == request.user.pk:
            raise PermissionDenied("You can't change your own role.")
        if target.role == Role.SUPER_ADMIN and role != Role.SUPER_ADMIN:
            others = User.objects.filter(role=Role.SUPER_ADMIN, is_active=True).exclude(pk=target.pk)
            if not others.exists():
                raise ValidationError({'role': ['This is the last super admin. Promote someone else first.']})
        if not target.is_active and role != Role.USER:
            raise ValidationError({'role': ['Reactivate this account before giving it a staff role.']})
        old = target.role
        target.role = role
        target.save(update_fields=['role'])  # audit-logged as user.privileges_changed
        record('admin.role_assigned', target, role=[old, role])
        if role != Role.USER:
            notify(target, f'You now have the {target.get_role_display()} role on Forge & Flight.', '/admin', icon='user', color='info')
        return Response(AdminUserSerializer(_user_queryset().get(pk=target.pk)).data)
