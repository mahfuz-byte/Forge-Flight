from django.db.models import Q
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from accounts.models import Role
from accounts.permissions import IsOwnerOrReadOnly
from audit.log import record
from audit.mixins import AuditStaffActionsMixin
from .models import Application, Investment, StartupComment, Startup
from .serializers import (
    ApplicationSerializer,
    InvestmentSerializer,
    StartupCommentSerializer,
    StartupDetailSerializer,
    StartupWriteSerializer,
)


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
        request.user.followed_startups.add(startup)
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
        serializer.save(author=self.request.user)


class ApplicationViewSet(viewsets.ModelViewSet):
    queryset = Application.objects.select_related('applicant', 'startup')
    serializer_class = ApplicationSerializer
    permission_classes = [permissions.IsAuthenticated]

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

    def perform_destroy(self, instance):
        if instance.applicant_id != self.request.user.id:
            raise PermissionDenied('Only the applicant can withdraw this application.')
        instance.delete()


class InvestmentViewSet(viewsets.ModelViewSet):
    queryset = Investment.objects.select_related('investor', 'startup')
    serializer_class = InvestmentSerializer
    permission_classes = [permissions.IsAuthenticated]

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

    def perform_create(self, serializer):
        serializer.save()
        inv = serializer.instance
        record('investment.create', inv, amount=str(inv.amount), startup=inv.startup_id)

    def perform_update(self, serializer):
        if serializer.instance.investor_id != self.request.user.id:
            raise PermissionDenied('Only the investor can edit this investment request.')
        old_amount = str(serializer.instance.amount)
        serializer.save()
        record('investment.update', serializer.instance, amount=[old_amount, str(serializer.instance.amount)])

    def perform_destroy(self, instance):
        if instance.investor_id != self.request.user.id:
            raise PermissionDenied('Only the investor can cancel this investment request.')
        record('investment.delete', instance, amount=str(instance.amount), startup=instance.startup_id)
        instance.delete()
