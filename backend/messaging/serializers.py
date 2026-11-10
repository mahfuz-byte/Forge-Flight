from rest_framework import serializers

from .models import Conversation, Message


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.ReadOnlyField(source='sender.name')

    class Meta:
        model = Message
        fields = ['id', 'conversation', 'sender', 'sender_name', 'text', 'read', 'created_at']
        read_only_fields = ['sender', 'read']

    def validate_conversation(self, conversation):
        user = self.context['request'].user
        if self.instance is not None and conversation != self.instance.conversation:
            raise serializers.ValidationError('A message cannot be moved to another conversation.')
        if user.id not in (conversation.initiator_id, conversation.startup.owner_id):
            raise serializers.ValidationError('You are not part of this conversation.')
        return conversation

    def create(self, validated_data):
        validated_data['sender'] = self.context['request'].user
        return super().create(validated_data)


class ConversationSerializer(serializers.ModelSerializer):
    startup_slug = serializers.ReadOnlyField(source='startup.slug')
    startup_name = serializers.ReadOnlyField(source='startup.name')
    startup_initials = serializers.ReadOnlyField(source='startup.initials')
    owner_name = serializers.ReadOnlyField(source='startup.owner.name')
    initiator_name = serializers.ReadOnlyField(source='initiator.name')
    initiator_avatar = serializers.ImageField(source='initiator.avatar', read_only=True)
    messages = MessageSerializer(many=True, read_only=True)

    class Meta:
        model = Conversation
        fields = [
            'id', 'startup', 'startup_slug', 'startup_name', 'startup_initials',
            'owner_name', 'initiator', 'initiator_name', 'initiator_avatar',
            'created_at', 'messages',
        ]
        read_only_fields = ['initiator', 'messages']

    def validate_startup(self, startup):
        if startup.owner_id == self.context['request'].user.id:
            raise serializers.ValidationError('You cannot message your own startup.')
        return startup

    def create(self, validated_data):
        validated_data['initiator'] = self.context['request'].user
        return super().create(validated_data)
