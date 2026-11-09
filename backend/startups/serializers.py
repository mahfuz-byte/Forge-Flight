from django.db import transaction
from rest_framework import serializers, status
from rest_framework.exceptions import APIException

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
from . import services
from .services import BusinessRuleError


class Conflict(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = 'This request conflicts with the current state.'
    default_code = 'conflict'


def api_error(exc):
    """Turn a BusinessRuleError into the DRF error the client should see (BE-10).

    The message is always in ``detail`` (what the UI shows); field errors are
    repeated under the field name for forms.
    """
    if exc.conflict:
        return Conflict(exc.message)
    body = {'detail': exc.message}
    if exc.field:
        body[exc.field] = [exc.message]
    return serializers.ValidationError(body)


class StartupImmutableOnUpdateMixin:
    """The startup a comment/application/investment belongs to can't be moved later."""

    def update(self, instance, validated_data):
        validated_data.pop('startup', None)
        return super().update(instance, validated_data)


class CollaborationRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = CollaborationRole
        fields = ['role', 'body', 'is_open', 'updated_at']
        read_only_fields = ['updated_at']


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


class StartupCommentSerializer(StartupImmutableOnUpdateMixin, serializers.ModelSerializer):
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
    """What a founder may set. ``raised`` is computed from investments (BE-04)."""

    class Meta:
        model = Startup
        fields = ['name', 'tagline', 'tags', 'goal', 'overview', 'status', 'deadline']

    def validate_goal(self, goal):
        if goal > 1_000_000_000:
            raise serializers.ValidationError('Funding goal is too large.')
        return goal

    def validate(self, attrs):
        startup = self.instance or Startup(goal=0, raised=0, status='soon')
        try:
            services.validate_funding_settings(startup, attrs.get('goal'), attrs.get('status'))
        except BusinessRuleError as exc:
            raise api_error(exc)
        return attrs

    def create(self, validated_data):
        validated_data['owner'] = self.context['request'].user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        with transaction.atomic():
            locked = Startup.objects.select_for_update().get(pk=instance.pk)
            for attr, value in validated_data.items():
                setattr(locked, attr, value)
            locked.save()
            if 'goal' in validated_data:
                services.recalculate_funding(locked)  # a lower goal may complete the round
        return locked


class ApplicationSerializer(StartupImmutableOnUpdateMixin, serializers.ModelSerializer):
    class Meta:
        model = Application
        fields = [
            'id', 'startup', 'applicant', 'role', 'name', 'email',
            'link', 'message', 'status', 'created_at', 'decided_at',
        ]
        read_only_fields = ['applicant', 'status', 'role', 'decided_at']

    def create(self, validated_data):
        startup = validated_data.pop('startup')
        validated_data.pop('role', None)
        try:
            return services.create_application(self.context['request'].user, startup, **validated_data)
        except BusinessRuleError as exc:
            raise api_error(exc)

    def update(self, instance, validated_data):
        if instance.status != Application.PENDING:
            raise Conflict(f'This application was already {instance.status} and can no longer be edited.')
        return super().update(instance, validated_data)


class InvestmentSerializer(StartupImmutableOnUpdateMixin, serializers.ModelSerializer):
    class Meta:
        model = Investment
        fields = [
            'id', 'startup', 'investor', 'amount', 'status', 'created_at', 'updated_at',
            'decided_at', 'decision_note',
        ]
        read_only_fields = ['investor', 'status', 'updated_at', 'decided_at', 'decision_note']

    def create(self, validated_data):
        try:
            return services.create_investment(
                self.context['request'].user, validated_data['startup'], validated_data['amount'],
            )
        except BusinessRuleError as exc:
            raise api_error(exc)

    def update(self, instance, validated_data):
        if 'amount' not in validated_data:
            return instance
        try:
            return services.change_investment_amount(instance, self.context['request'].user, validated_data['amount'])
        except BusinessRuleError as exc:
            raise api_error(exc)
