from django.db.models import Q
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from accounts.models import Role
from accounts.permissions import IsOwnerOrReadOnly
from audit.log import record
from audit.mixins import AuditStaffActionsMixin
from notifications.services import notify
from . import services
from .models import Application, Investment, StartupComment, Startup
from .serializers import (
    ApplicationSerializer,
    CollaborationRoleSerializer,
    Conflict,
    DocumentSerializer,
    InvestmentSerializer,
    StartupCommentSerializer,
    StartupDetailSerializer,
    StartupWriteSerializer,
    api_error,
)


def _run(fn, *args, **kwargs):
    """Call a service, mapping its errors onto HTTP responses (BE-10)."""
    try:
        return fn(*args, **kwargs)
    except services.BusinessRuleError as exc:
        raise api_error(exc)
    except PermissionError:
        raise PermissionDenied('Only the startup owner can do this.')


def _decision(request):
    return str(request.data.get('note') or request.data.get('reason') or '').strip()


class StartupViewSet(AuditStaffActionsMixin, viewsets.ModelViewSet):
    queryset = Startup.objects.select_related('owner').prefetch_related(
        'team', 'timeline', 'docs', 'updates', 'comments__author', 'collab',
    )
    lookup_field = 'slug'
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    owner_field = 'owner_id'
    staff_roles = (Role.ADMIN,)

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return StartupWriteSerializer
        return StartupDetailSerializer

    def create(self, request, *args, **kwargs):
        write_serializer = self.get_serializer(data=request.data)
        write_serializer.is_valid(raise_exception=True)
        instance = write_serializer.save()
        return Response(StartupDetailSerializer(instance).data, status=201)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        write_serializer = self.get_serializer(instance, data=request.data, partial=kwargs.get('partial', False))
        write_serializer.is_valid(raise_exception=True)
        self.audit_if_staff(instance, 'update', fields=sorted(write_serializer.validated_data))
        instance = write_serializer.save()
        return Response(StartupDetailSerializer(instance).data)

    def perform_destroy(self, instance):
        # Deleting a startup would cascade-delete investment history (FE-10).
        if instance.investments.filter(status__in=Investment.COUNTED_STATUSES).exists():
            raise Conflict(
                "This startup has accepted investments, so it can't be deleted. "
                'Close the funding round instead, or contact support.'
            )
        self.audit_if_staff(instance, 'delete')
        record('startup.delete', instance, owner_id=instance.owner_id)
        instance.delete()

    @action(
        detail=True, methods=['post'], url_path='documents',
        parser_classes=[MultiPartParser, FormParser, JSONParser],
    )
    def add_document(self, request, slug=None):
        """Upload a pitch deck or other document (owner only, FE-09)."""
        startup = self.get_object()
        serializer = DocumentSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(startup=startup, order=startup.docs.count())
        return Response(serializer.data, status=201)

    @action(detail=True, methods=['delete'], url_path=r'documents/(?P<doc_id>\d+)')
    def remove_document(self, request, slug=None, doc_id=None):
        startup = self.get_object()
        doc = startup.docs.filter(pk=doc_id).first()
        if doc is None:
            return Response({'detail': 'Document not found.'}, status=404)
        if doc.file:
            doc.file.delete(save=False)
        doc.delete()
        return Response(status=204)

    @action(detail=True, methods=['put', 'patch'], url_path='collaboration')
    def collaboration(self, request, slug=None):
        """Create/update the collaboration listing; ``is_open`` publishes it (BE-07)."""
        startup = self.get_object()  # IsOwnerOrReadOnly: owner or admin only
        current = getattr(startup, 'collab', None)
        data = request.data
        collab = _run(
            services.save_collaboration, startup,
            data.get('role', current.role if current else ''),
            data.get('body', current.body if current else ''),
            _as_bool(data.get('is_open', current.is_open if current else True)),
        )
        self.audit_if_staff(startup, 'collaboration_update')
        return Response(CollaborationRoleSerializer(collab).data)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def save(self, request, slug=None):
        startup = self.get_object()
        request.user.saved_startups.add(startup)
        return Response(status=204)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def unsave(self, request, slug=None):
        startup = self.get_object()
        request.user.saved_startups.remove(startup)
        return Response(status=204)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def follow(self, request, slug=None):
        startup = self.get_object()
        if not request.user.followed_startups.filter(pk=startup.pk).exists():
            request.user.followed_startups.add(startup)
            notify(
                startup.owner, f'{request.user.name} started following {startup.name}.',
                f'/profile/{startup.pk}', icon='user', color='info', actor=request.user,
            )
        return Response(status=204)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def unfollow(self, request, slug=None):
        startup = self.get_object()
        request.user.followed_startups.remove(startup)
        return Response(status=204)


class StartupCommentViewSet(AuditStaffActionsMixin, viewsets.ModelViewSet):
    audit_label = 'comment'
    queryset = StartupComment.objects.select_related('author', 'startup')
    serializer_class = StartupCommentSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    owner_field = 'author_id'
    staff_roles = (Role.MODERATOR, Role.ADMIN)

    def get_queryset(self):
        qs = super().get_queryset()
        startup_slug = self.request.query_params.get('startup')
        return qs.filter(startup__slug=startup_slug) if startup_slug else qs

    def perform_create(self, serializer):
        comment = serializer.save(author=self.request.user)
        notify(
            comment.startup.owner, f'{self.request.user.name} commented on {comment.startup.name}: "{comment.text[:80]}"',
            f'/profile/{comment.startup_id}', icon='comment', color='info', actor=self.request.user,
        )


class ApplicationViewSet(viewsets.ModelViewSet):
    queryset = Application.objects.select_related('applicant', 'startup')
    serializer_class = ApplicationSerializer
    permission_classes = [permissions.IsAuthenticated]
    # No DELETE: withdrawing keeps the record (POST .../withdraw/).
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_queryset(self):
        # Visible to the applicant and to the owner of the startup applied to.
        user = self.request.user
        qs = super().get_queryset()
        if not user.has_role(Role.ADMIN):
            qs = qs.filter(Q(applicant=user) | Q(startup__owner=user))
        startup_slug = self.request.query_params.get('startup')
        if startup_slug:
            qs = qs.filter(startup__slug=startup_slug)
        mine = self.request.query_params.get('mine')
        if mine:
            qs = qs.filter(applicant=self.request.user)
        return qs

    def perform_update(self, serializer):
        # Only the applicant edits their application. Accept/decline by the
        # startup owner is a separate, explicit operation (Phase 3, BE-01).
        if serializer.instance.applicant_id != self.request.user.id:
            raise PermissionDenied('Only the applicant can edit this application.')
        serializer.save()

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        app = _run(services.decide_application, self.get_object(), request.user, accept=True)
        return Response(ApplicationSerializer(app).data)

    @action(detail=True, methods=['post'])
    def decline(self, request, pk=None):
        app = _run(services.decide_application, self.get_object(), request.user, accept=False)
        return Response(ApplicationSerializer(app).data)

    @action(detail=True, methods=['post'])
    def withdraw(self, request, pk=None):
        app = self.get_object()
        if app.applicant_id != request.user.id:
            raise PermissionDenied('Only the applicant can withdraw this application.')
        return Response(ApplicationSerializer(_run(services.withdraw_application, app, request.user)).data)


class InvestmentViewSet(viewsets.ModelViewSet):
    queryset = Investment.objects.select_related('investor', 'startup')
    serializer_class = InvestmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    # No DELETE: requests are withdrawn/rejected, never erased (BE-02).
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_queryset(self):
        # Visible to the investor, the startup's owner and finance staff.
        user = self.request.user
        qs = super().get_queryset()
        if not user.has_role(Role.FINANCE_ADMIN, Role.ADMIN):
            qs = qs.filter(Q(investor=user) | Q(startup__owner=user))
        startup_slug = self.request.query_params.get('startup')
        if startup_slug:
            qs = qs.filter(startup__slug=startup_slug)
        mine = self.request.query_params.get('mine')
        if mine:
            qs = qs.filter(investor=self.request.user)
        return qs

    def perform_update(self, serializer):
        if serializer.instance.investor_id != self.request.user.id:
            raise PermissionDenied('Only the investor can edit this investment request.')
        serializer.save()

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        inv = _run(services.decide_investment, self.get_object(), request.user, accept=True, note=_decision(request))
        return Response(InvestmentSerializer(inv).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        inv = _run(services.decide_investment, self.get_object(), request.user, accept=False, note=_decision(request))
        return Response(InvestmentSerializer(inv).data)

    @action(detail=True, methods=['post'])
    def withdraw(self, request, pk=None):
        inv = self.get_object()
        if inv.investor_id != request.user.id:
            raise PermissionDenied('Only the investor can withdraw this request.')
        return Response(InvestmentSerializer(_run(services.withdraw_investment, inv, request.user)).data)


def _as_bool(value):
    if isinstance(value, str):
        return value.strip().lower() in ('1', 'true', 'yes', 'on')
    return bool(value)
