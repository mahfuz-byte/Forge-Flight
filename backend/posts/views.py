from rest_framework import permissions, viewsets

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
