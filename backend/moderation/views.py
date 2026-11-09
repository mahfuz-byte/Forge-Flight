from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from rest_framework import permissions, serializers, status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from posts.models import Post
from startups.models import Startup, StartupComment

from .models import Report


def _resolve_target(target_type, target_id):
    """(object, owner_id) for a report target, or (None, None) if it doesn't exist."""
    try:
        if target_type == Report.POST:
            obj = Post.objects.get(pk=int(target_id))
            return obj, obj.author_id
        if target_type == Report.COMMENT:
            obj = StartupComment.objects.get(pk=int(target_id))
            return obj, obj.author_id
        if target_type == Report.STARTUP:
            obj = Startup.objects.get(pk=target_id)
            return obj, obj.owner_id
        if target_type == Report.USER:
            obj = get_user_model().objects.get(pk=int(target_id), is_active=True)
            return obj, obj.pk
    except (ValueError, Post.DoesNotExist, StartupComment.DoesNotExist, Startup.DoesNotExist,
            get_user_model().DoesNotExist):
        pass
    return None, None


class ReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = ['id', 'target_type', 'target_id', 'reason', 'details', 'status', 'created_at']
        read_only_fields = ['id', 'status', 'created_at']


class ReportThrottle(UserRateThrottle):
    rate = '30/hour'


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@throttle_classes([ReportThrottle])
def create_report(request):
    """Members report content for moderator review."""
    serializer = ReportSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    target, owner_id = _resolve_target(data['target_type'], str(data['target_id']))
    if target is None:
        return Response({'detail': "That content doesn't exist anymore."}, status=404)
    if owner_id == request.user.id:
        return Response({'detail': "You can't report your own content."}, status=400)
    try:
        with transaction.atomic():
            report = Report.objects.create(
                reporter=request.user, target_type=data['target_type'], target_id=str(target.pk),
                target_repr=str(target)[:255], reason=data['reason'], details=data.get('details', ''),
            )
    except IntegrityError:
        # Already reported and still open: treat as success, don't double count.
        return Response({'detail': 'You already reported this. Our moderators will review it.'}, status=200)
    return Response(ReportSerializer(report).data, status=status.HTTP_201_CREATED)
