from rest_framework import serializers

from .models import Post


class PostSerializer(serializers.ModelSerializer):
    startup_name = serializers.ReadOnlyField(source='startup.name')
    author_name = serializers.ReadOnlyField(source='author.name')
    author_avatar = serializers.ImageField(source='author.avatar', read_only=True)
    likes_count = serializers.IntegerField(source='likes.count', read_only=True)
    is_liked = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            'id', 'kind', 'startup', 'startup_name', 'author', 'author_name', 'author_avatar',
            'post_type', 'title', 'text', 'tags', 'media', 'created_at',
            'likes_count', 'is_liked', 'pinned'
        ]
        read_only_fields = ['author']

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(id=request.user.id).exists()
        return False

    def validate_startup(self, startup):
        # Posting as a startup is reserved for that startup's owner.
        user = self.context['request'].user
        if startup is not None and startup.owner_id != user.id and not user.can_moderate:
            raise serializers.ValidationError('You can only post on behalf of a startup you own.')
        return startup

    def validate(self, attrs):
        # Pinning puts a post at the top of a startup page: owner or moderators only.
        if attrs.get('pinned'):
            user = self.context['request'].user
            startup = self.instance.startup if self.instance else attrs.get('startup')
            if not user.can_moderate and (startup is None or startup.owner_id != user.id):
                raise serializers.ValidationError({'pinned': 'Only the startup owner can pin posts.'})
        return attrs

    def update(self, instance, validated_data):
        validated_data.pop('startup', None)  # a post can't be moved to another startup
        return super().update(instance, validated_data)

    def create(self, validated_data):
        validated_data['author'] = self.context['request'].user
        return super().create(validated_data)
