from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Application, Investment, StartupComment, Startup
from .serializers import (
    ApplicationSerializer,
    InvestmentSerializer,
    StartupCommentSerializer,
    StartupDetailSerializer,
    StartupWriteSerializer,
)


class IsOwnerOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.owner_id == request.user.id


class StartupViewSet(viewsets.ModelViewSet):
    queryset = Startup.objects.select_related('owner').prefetch_related(
        'team', 'timeline', 'docs', 'updates', 'comments__author', 'collab',
    )
    lookup_field = 'slug'
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

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


class StartupCommentViewSet(viewsets.ModelViewSet):
    queryset = StartupComment.objects.select_related('author', 'startup')
    serializer_class = StartupCommentSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

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
        qs = super().get_queryset()
        startup_slug = self.request.query_params.get('startup')
        if startup_slug:
            qs = qs.filter(startup__slug=startup_slug)
        mine = self.request.query_params.get('mine')
        if mine:
            qs = qs.filter(applicant=self.request.user)
        return qs


class InvestmentViewSet(viewsets.ModelViewSet):
    queryset = Investment.objects.select_related('investor', 'startup')
    serializer_class = InvestmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        startup_slug = self.request.query_params.get('startup')
        if startup_slug:
            qs = qs.filter(startup__slug=startup_slug)
        mine = self.request.query_params.get('mine')
        if mine:
            qs = qs.filter(investor=self.request.user)
        return qs
