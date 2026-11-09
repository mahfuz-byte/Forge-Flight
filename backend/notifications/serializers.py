from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'icon', 'color', 'text', 'link', 'read', 'created_at']
        # Recipients can only mark notifications read; content comes from the server.
        read_only_fields = ['id', 'icon', 'color', 'text', 'link', 'created_at']
