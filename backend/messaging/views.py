from django.db.models import Q
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Conversation, Message
from .serializers import ConversationSerializer, MessageSerializer


class ConversationViewSet(viewsets.ModelViewSet):
    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        user = self.request.user
        return Conversation.objects.filter(
            Q(initiator=user) | Q(startup__owner=user),
        ).select_related('startup', 'startup__owner', 'initiator').prefetch_related('messages__sender')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        conversation, created = Conversation.objects.get_or_create(
            startup=serializer.validated_data['startup'],
            initiator=request.user,
        )
        return Response(self.get_serializer(conversation).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def read(self, request, pk=None):
        conversation = self.get_object()
        conversation.messages.exclude(sender=request.user).filter(read=False).update(read=True)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        user = self.request.user
        qs = Message.objects.filter(
            Q(conversation__initiator=user) | Q(conversation__startup__owner=user),
        ).select_related('sender', 'conversation', 'conversation__startup')
        conversation_id = self.request.query_params.get('conversation')
        return qs.filter(conversation_id=conversation_id) if conversation_id else qs
