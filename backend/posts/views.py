from rest_framework import permissions, viewsets
from rest_framework.pagination import PageNumberPagination
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.models import Role
from accounts.permissions import IsOwnerOrReadOnly
from audit.mixins import AuditStaffActionsMixin
from notifications.services import notify

from .models import Post
from .serializers import PostSerializer


class PostPagination(PageNumberPagination):
    """Feed pages (FE-05): ``?page=2``; ``?page_size=`` up to 50."""

    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 50


class PostViewSet(AuditStaffActionsMixin, viewsets.ModelViewSet):
    queryset = Post.objects.select_related('startup', 'author')
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    owner_field = 'author_id'
    staff_roles = (Role.MODERATOR, Role.ADMIN)
    pagination_class = PostPagination

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if params.get('startup'):
            qs = qs.filter(startup__slug=params['startup'])
        if params.get('has_media'):  # startup gallery (FE-09)
            qs = qs.exclude(media='').exclude(media__isnull=True)
        # A stable order so pages never repeat or skip posts.
        return qs.order_by('-pinned', '-created_at', '-id')

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def toggle_like(self, request, pk=None):
        post = self.get_object()
        user = request.user
        if post.likes.filter(id=user.id).exists():
            post.likes.remove(user)
            is_liked = False
        else:
            post.likes.add(user)
            is_liked = True
            notify(
                post.author, f'{user.name} liked your post "{post.title[:60]}".',
                f'/profile/{post.startup_id}' if post.startup_id else '/feed',
                icon='heart', color='accent', actor=user,
            )
        return Response({'is_liked': is_liked, 'likes_count': post.likes.count()})
