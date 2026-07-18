from django.db.models import Q
from rest_framework import permissions, viewsets

from .models import Conversation, Message
from .serializers import ConversationSerializer, MessageSerializer


class ConversationViewSet(viewsets.ModelViewSet):
    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Conversation.objects.filter(
            Q(initiator=user) | Q(startup__owner=user),
        ).select_related('startup', 'initiator').prefetch_related('messages')


class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Message.objects.filter(
            Q(conversation__initiator=user) | Q(conversation__startup__owner=user),
        ).select_related('sender', 'conversation')
        conversation_id = self.request.query_params.get('conversation')
        return qs.filter(conversation_id=conversation_id) if conversation_id else qs
