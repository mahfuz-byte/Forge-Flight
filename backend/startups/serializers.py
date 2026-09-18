from rest_framework import serializers

from .models import (
    Application,
    CollaborationRole,
    Document,
    Investment,
    StartupComment,
    Startup,
    TeamMember,
    TimelineEvent,
    UpdateEntry,
)


class CollaborationRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = CollaborationRole
        fields = ['role', 'body']


class TeamMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeamMember
        fields = ['id', 'name', 'title', 'order']


class TimelineEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimelineEvent
        fields = ['id', 'date_label', 'title', 'description', 'order']


class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = ['id', 'name', 'size', 'file', 'order']


class UpdateEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = UpdateEntry
        fields = ['id', 'text', 'created_at']


class StartupCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.ReadOnlyField(source='author.name')

    class Meta:
        model = StartupComment
        fields = ['id', 'startup', 'author', 'author_name', 'text', 'created_at']
        read_only_fields = ['author']


class StartupDetailSerializer(serializers.ModelSerializer):
    founder = serializers.ReadOnlyField(source='owner.name')
    funding_pct = serializers.ReadOnlyField()
    collab = CollaborationRoleSerializer(read_only=True)
    team = TeamMemberSerializer(many=True, read_only=True)
    timeline = TimelineEventSerializer(many=True, read_only=True)
    docs = DocumentSerializer(many=True, read_only=True)
    updates = UpdateEntrySerializer(many=True, read_only=True)
    comments = StartupCommentSerializer(many=True, read_only=True)

    class Meta:
        model = Startup
        fields = [
            'slug', 'name', 'initials', 'verified', 'owner', 'founder',
            'tagline', 'status', 'tags', 'goal', 'raised', 'funding_pct',
            'deadline', 'overview', 'created_at', 'updated_at',
            'collab', 'team', 'timeline', 'docs', 'updates', 'comments',
        ]


class StartupWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Startup
        fields = ['name', 'tagline', 'tags', 'goal', 'overview']

    def create(self, validated_data):
        validated_data['owner'] = self.context['request'].user
        return super().create(validated_data)


class ApplicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Application
        fields = [
            'id', 'startup', 'applicant', 'role', 'name', 'email',
            'link', 'message', 'status', 'created_at',
        ]
        read_only_fields = ['applicant', 'status']

    def create(self, validated_data):
        validated_data['applicant'] = self.context['request'].user
        return super().create(validated_data)


class InvestmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Investment
        fields = ['id', 'startup', 'investor', 'amount', 'status', 'created_at']
        read_only_fields = ['investor', 'status']

    def create(self, validated_data):
        validated_data['investor'] = self.context['request'].user
        return super().create(validated_data)
