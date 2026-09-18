from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Post
from .serializers import PostSerializer


class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.select_related('startup', 'author')
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = super().get_queryset()
        startup_slug = self.request.query_params.get('startup')
        return qs.filter(startup__slug=startup_slug) if startup_slug else qs

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
        return Response({'is_liked': is_liked, 'likes_count': post.likes.count()})
