"""Module 5 — Community Management, and 6 — Reports & Moderation."""
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, IntegerField, OuterRef, Q, Subquery, Value
from django.db.models.functions import Cast, Coalesce
from django.utils import timezone
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from audit.log import record
from core.admin_api import AdminAPIMixin
from moderation.models import Report
from notifications.services import notify
from posts.models import Post
from startups.models import Startup, StartupComment

from .common import note_from, require

User = get_user_model()


def _open_reports_for(target_type):
    """Subquery: number of open reports on each row of the outer queryset."""
    return Coalesce(Subquery(
        Report.objects.filter(
            target_type=target_type, status=Report.OPEN,
            target_id=Cast(OuterRef('pk'), output_field=Report._meta.get_field('target_id')),
        ).values('target_id').annotate(c=Count('pk')).values('c')[:1],
        output_field=IntegerField(),
    ), Value(0))


# ------------------------------------------------------------------ posts & comments


class AdminPostSerializer(serializers.ModelSerializer):
    author_name = serializers.ReadOnlyField(source='author.name')
    author_email = serializers.ReadOnlyField(source='author.email')
    startup_name = serializers.ReadOnlyField(source='startup.name')
    open_reports = serializers.IntegerField(read_only=True)
    likes_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Post
        fields = [
            'id', 'title', 'text', 'post_type', 'media', 'startup', 'startup_name', 'author', 'author_name',
            'author_email', 'created_at', 'pinned', 'likes_count', 'open_reports',
        ]


class AdminCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.ReadOnlyField(source='author.name')
    author_email = serializers.ReadOnlyField(source='author.email')
    startup_name = serializers.ReadOnlyField(source='startup.name')
    open_reports = serializers.IntegerField(read_only=True)

    class Meta:
        model = StartupComment
        fields = ['id', 'text', 'startup', 'startup_name', 'author', 'author_name', 'author_email', 'created_at', 'open_reports']


def _remove_content(request, obj, kind, reason):
    """Delete a post/comment as a moderator: audit, tell the author, close its reports."""
    author = obj.author
    label = obj.title if kind == Report.POST else obj.text[:60]
    record(f'admin.{kind}_removed', obj, reason=reason, author_id=author.pk if author else None)
    Report.objects.filter(target_type=kind, target_id=str(obj.pk), status=Report.OPEN).update(
        status=Report.RESOLVED, handled_by=request.user, handled_at=timezone.now(),
        resolution=f'Content removed: {reason}',
    )
    obj.delete()
    notify(author, f'Your {kind} "{label}" was removed by a moderator: {reason}', '/feed', icon='flag', color='warning')


class _ModerationViewSet(AdminAPIMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin,
                         mixins.DestroyModelMixin, viewsets.GenericViewSet):
    admin_capability = 'content.moderate'
    kind = None

    def filter_common(self, qs, text_fields):
        p = self.request.query_params
        if p.get('q'):
            q = p['q'].strip()
            cond = Q(author__email__icontains=q)
            for f in text_fields:
                cond |= Q(**{f'{f}__icontains': q})
            qs = qs.filter(cond)
        if p.get('startup'):
            qs = qs.filter(startup__slug=p['startup'])
        if p.get('reported') == '1':
            qs = qs.filter(open_reports__gt=0)
        if p.get('author'):
            qs = qs.filter(author_id=p['author'])
        return qs

    def destroy(self, request, *args, **kwargs):
        """Remove content. Body (or query): ``reason`` (required, sent to the author)."""
        reason = str(request.data.get('reason') or request.query_params.get('reason') or '').strip()[:500]
        if not reason:
            raise ValidationError({'reason': ['Tell the author why this is being removed.']})
        _remove_content(request, self.get_object(), self.kind, reason)
        return Response(status=204)


class AdminPostViewSet(_ModerationViewSet):
    """Filters: ``q``, ``startup``, ``author``, ``reported`` (1 = has open reports)."""

    serializer_class = AdminPostSerializer
    kind = Report.POST

    def get_queryset(self):
        qs = Post.objects.select_related('author', 'startup').annotate(
            open_reports=_open_reports_for(Report.POST), likes_count=Count('likes', distinct=True),
        )
        return self.filter_common(qs, ['title', 'text']).order_by('-open_reports', '-created_at', '-id')


class AdminCommentViewSet(_ModerationViewSet):
    """Filters: ``q``, ``startup``, ``author``, ``reported``."""

    serializer_class = AdminCommentSerializer
    kind = Report.COMMENT

    def get_queryset(self):
        qs = StartupComment.objects.select_related('author', 'startup').annotate(
            open_reports=_open_reports_for(Report.COMMENT),
        )
        return self.filter_common(qs, ['text']).order_by('-open_reports', '-created_at', '-id')


# ------------------------------------------------------------------ reports


def _target_info(report):
    """Where the reported thing lives now (it may have been removed)."""
    t, tid = report.target_type, report.target_id
    try:
        if t == Report.POST:
            post = Post.objects.select_related('startup').get(pk=int(tid))
            return {'exists': True, 'link': f'/profile/{post.startup_id}' if post.startup_id else '/feed', 'text': post.text[:500]}
        if t == Report.COMMENT:
            c = StartupComment.objects.get(pk=int(tid))
            return {'exists': True, 'link': f'/profile/{c.startup_id}#comments', 'text': c.text[:500]}
        if t == Report.STARTUP:
            s = Startup.objects.get(pk=tid)
            return {'exists': True, 'link': f'/profile/{s.pk}', 'text': s.tagline, 'review_status': s.review_status}
        if t == Report.USER:
            u = User.objects.get(pk=int(tid))
            return {'exists': True, 'link': '', 'text': u.email, 'is_active': u.is_active}
    except (ValueError, Post.DoesNotExist, StartupComment.DoesNotExist, Startup.DoesNotExist, User.DoesNotExist):
        pass
    return {'exists': False, 'link': '', 'text': ''}


class AdminReportSerializer(serializers.ModelSerializer):
    reporter_email = serializers.ReadOnlyField(source='reporter.email')
    handled_by_name = serializers.ReadOnlyField(source='handled_by.name')
    reason_label = serializers.CharField(source='get_reason_display', read_only=True)
    same_target_open = serializers.SerializerMethodField()
    target = serializers.SerializerMethodField()

    class Meta:
        model = Report
        fields = [
            'id', 'target_type', 'target_id', 'target_repr', 'target', 'reason', 'reason_label', 'details',
            'status', 'created_at', 'reporter_email', 'handled_by_name', 'handled_at', 'resolution',
            'same_target_open',
        ]

    def get_target(self, report):
        return _target_info(report)

    def get_same_target_open(self, report):
        return getattr(report, 'same_target_open', 0)


RESOLUTION_ACTIONS = ('none', 'remove_content', 'suspend_startup', 'suspend_user')


class AdminReportViewSet(AdminAPIMixin, viewsets.ReadOnlyModelViewSet):
    """Investigate reports and record what was done.

    Filters: ``status`` (default open), ``target_type``, ``reason``, ``q``.
    """

    admin_capability = 'reports.manage'
    serializer_class = AdminReportSerializer

    def get_queryset(self):
        same = Report.objects.filter(
            target_type=OuterRef('target_type'), target_id=OuterRef('target_id'), status=Report.OPEN,
        ).values('target_type').annotate(c=Count('pk')).values('c')[:1]
        qs = Report.objects.select_related('reporter', 'handled_by').annotate(
            same_target_open=Coalesce(Subquery(same, output_field=IntegerField()), Value(0)),
        )
        p = self.request.query_params
        if self.action != 'list':
            return qs  # resolving/viewing one report works whatever its status
        status = p.get('status', 'open')
        if status != 'all':
            qs = qs.filter(status=status)
        if p.get('target_type'):
            qs = qs.filter(target_type=p['target_type'])
        if p.get('reason'):
            qs = qs.filter(reason=p['reason'])
        if p.get('q'):
            q = p['q'].strip()
            qs = qs.filter(Q(target_repr__icontains=q) | Q(details__icontains=q) | Q(reporter__email__icontains=q))
        return qs.order_by('-same_target_open', '-created_at')

    def _close(self, request, report, status, resolution):
        """Close this report and every other open report on the same target."""
        return Report.objects.filter(
            target_type=report.target_type, target_id=report.target_id, status=Report.OPEN,
        ).update(status=status, handled_by=request.user, handled_at=timezone.now(), resolution=resolution)

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        """Body: ``resolution`` (required), ``action`` (none|remove_content|suspend_startup|suspend_user)."""
        report = self.get_object()
        if report.status != Report.OPEN:
            raise ValidationError({'detail': f'This report is already {report.status}.'})
        resolution = note_from(request, required=True, field='resolution', max_length=1000)
        act = request.data.get('action', 'none')
        if act not in RESOLUTION_ACTIONS:
            raise ValidationError({'action': ['Unknown action.']})

        with transaction.atomic():
            if act == 'remove_content':
                if report.target_type == Report.POST:
                    obj = Post.objects.filter(pk=int(report.target_id)).first()
                elif report.target_type == Report.COMMENT:
                    obj = StartupComment.objects.filter(pk=int(report.target_id)).first()
                else:
                    raise ValidationError({'action': ['Only posts and comments can be removed this way.']})
                if obj is not None:
                    require(request, 'content.moderate')
                    _remove_content(request, obj, report.target_type, resolution)
            elif act == 'suspend_startup':
                require(request, 'startups.manage')
                if report.target_type != Report.STARTUP:
                    raise ValidationError({'action': ['This report is not about a startup.']})
                startup = Startup.objects.filter(pk=report.target_id).first()
                if startup and startup.review_status != Startup.REVIEW_SUSPENDED:
                    startup.review_status = Startup.REVIEW_SUSPENDED
                    startup.review_note = resolution[:500]
                    startup.reviewed_by, startup.reviewed_at = request.user, timezone.now()
                    startup.featured = False
                    startup.save(update_fields=['review_status', 'review_note', 'reviewed_by', 'reviewed_at', 'featured'])
                    record('admin.startup_suspend', startup, note=resolution, report=report.pk)
                    notify(startup.owner, f'{startup.name} has been suspended: {resolution}', f'/dashboard/{startup.pk}', icon='flag', color='warning')
            elif act == 'suspend_user':
                require(request, 'users.manage')
                if report.target_type != Report.USER:
                    raise ValidationError({'action': ['This report is not about a person.']})
                from .users import _outranks_or_403
                target = User.objects.filter(pk=int(report.target_id)).first()
                if target and target.is_active:
                    _outranks_or_403(request.user, target)
                    target.is_active = False
                    target.save(update_fields=['is_active'])
                    record('admin.user_suspended', target, reason=resolution, report=report.pk)
            closed = self._close(request, report, Report.RESOLVED, resolution)
        record('admin.report_resolved', report, taken_action=act, resolution=resolution, closed=closed)
        return Response(self.get_serializer(Report.objects.get(pk=report.pk)).data)

    @action(detail=True, methods=['post'])
    def dismiss(self, request, pk=None):
        """No rule was broken. Body: ``resolution`` (required)."""
        report = self.get_object()
        if report.status != Report.OPEN:
            raise ValidationError({'detail': f'This report is already {report.status}.'})
        resolution = note_from(request, required=True, field='resolution', max_length=1000)
        closed = self._close(request, report, Report.DISMISSED, resolution)
        record('admin.report_dismissed', report, resolution=resolution, closed=closed)
        return Response(self.get_serializer(Report.objects.get(pk=report.pk)).data)
