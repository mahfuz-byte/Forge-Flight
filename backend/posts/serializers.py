from rest_framework import serializers

from .models import Post


class PostSerializer(serializers.ModelSerializer):
    startup_name = serializers.ReadOnlyField(source='startup.name')
    author_name = serializers.ReadOnlyField(source='author.name')
    likes_count = serializers.IntegerField(source='likes.count', read_only=True)
    is_liked = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            'id', 'kind', 'startup', 'startup_name', 'author', 'author_name',
            'post_type', 'title', 'text', 'tags', 'media', 'created_at',
            'likes_count', 'is_liked', 'pinned'
        ]
        read_only_fields = ['author']

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(id=request.user.id).exists()
        return False

    def create(self, validated_data):
        validated_data['author'] = self.context['request'].user
        return super().create(validated_data)
