from django.db.models import Q
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied

from notifications.services import notify

from .models import Conversation, Message
from .serializers import ConversationSerializer, MessageSerializer


class ConversationViewSet(viewsets.ModelViewSet):
    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated]
    # Conversations are opened, never edited or deleted through the API.
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        user = self.request.user
        return Conversation.objects.filter(
            Q(initiator=user) | Q(startup__owner=user),
        ).select_related('startup', 'initiator').prefetch_related('messages')

    @action(detail=True, methods=['post'])
    def read(self, request, pk=None):
        """Mark every message from the other person as read in one call (FE-08)."""
        conversation = self.get_object()
        updated = conversation.messages.filter(read=False).exclude(sender=request.user).update(read=True)
        return Response({'marked_read': updated})

    @action(detail=False, methods=['get'])
    def unread(self, request):
        """Unread message counts for the badge, without loading threads."""
        qs = Message.objects.filter(
            Q(conversation__initiator=request.user) | Q(conversation__startup__owner=request.user),
            read=False,
        ).exclude(sender=request.user)
        return Response({'total': qs.count(), 'conversations': qs.values('conversation').distinct().count()})


class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        user = self.request.user
        qs = Message.objects.filter(
            Q(conversation__initiator=user) | Q(conversation__startup__owner=user),
        ).select_related('sender', 'conversation')
        conversation_id = self.request.query_params.get('conversation')
        return qs.filter(conversation_id=conversation_id) if conversation_id else qs

    def perform_create(self, serializer):
        message = serializer.save()
        convo = message.conversation
        recipient = convo.startup.owner if message.sender_id == convo.initiator_id else convo.initiator
        notify(
            recipient, f'New message from {message.sender.name}: "{message.text[:80]}"',
            '/messages', icon='msg', color='info', actor=message.sender,
        )

    def perform_update(self, serializer):
        # The sender may edit the text; the recipient may only mark it read.
        user = self.request.user
        message = serializer.instance
        changed = set(serializer.validated_data)
        if message.sender_id == user.id:
            if 'read' in changed:
                raise PermissionDenied('Only the recipient can mark a message as read.')
        elif changed - {'read'}:
            raise PermissionDenied("You can't edit someone else's message.")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.sender_id != self.request.user.id:
            raise PermissionDenied("You can't delete someone else's message.")
        instance.delete()
