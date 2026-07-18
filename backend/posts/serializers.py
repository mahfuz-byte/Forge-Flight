from rest_framework import serializers

from .models import Post


class PostSerializer(serializers.ModelSerializer):
    startup_name = serializers.ReadOnlyField(source='startup.name')
    author_name = serializers.ReadOnlyField(source='author.name')

    class Meta:
        model = Post
        fields = [
            'id', 'kind', 'startup', 'startup_name', 'author', 'author_name',
            'post_type', 'title', 'text', 'tags', 'media', 'created_at',
        ]
        read_only_fields = ['author']

    def create(self, validated_data):
        validated_data['author'] = self.context['request'].user
        return super().create(validated_data)
