from django.contrib import admin

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


class TeamMemberInline(admin.TabularInline):
    model = TeamMember
    extra = 0


class TimelineEventInline(admin.TabularInline):
    model = TimelineEvent
    extra = 0


class DocumentInline(admin.TabularInline):
    model = Document
    extra = 0


class UpdateEntryInline(admin.TabularInline):
    model = UpdateEntry
    extra = 0


class CollaborationRoleInline(admin.StackedInline):
    model = CollaborationRole
    extra = 0


@admin.register(Startup)
class StartupAdmin(admin.ModelAdmin):
    list_display = ('name', 'owner', 'status', 'verified', 'goal', 'raised', 'created_at')
    list_filter = ('status', 'verified')
    search_fields = ('name', 'slug', 'owner__email')
    prepopulated_fields = {'slug': ('name',)}
    # `raised` is computed from investments; staff record prior funding in external_raised.
    readonly_fields = ('raised',)
    inlines = [CollaborationRoleInline, TeamMemberInline, TimelineEventInline, DocumentInline, UpdateEntryInline]

    def save_model(self, request, obj, form, change):
        from django.db import transaction

        from .services import recalculate_funding
        with transaction.atomic():
            super().save_model(request, obj, form, change)
            recalculate_funding(obj)  # external_raised or goal may have changed


@admin.register(StartupComment)
class StartupCommentAdmin(admin.ModelAdmin):
    list_display = ('startup', 'author', 'created_at')
    search_fields = ('text',)


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ('startup', 'applicant', 'role', 'status', 'created_at', 'decided_at')
    list_filter = ('status',)
    readonly_fields = ('status', 'decided_at', 'decided_by')


@admin.register(Investment)
class InvestmentAdmin(admin.ModelAdmin):
    list_display = ('startup', 'investor', 'amount', 'status', 'created_at', 'decided_at')
    list_filter = ('status',)
    # Status and amount only change through the API so funding totals stay correct.
    readonly_fields = ('amount', 'status', 'decided_at', 'decided_by', 'decision_note', 'created_at', 'updated_at')

    def has_delete_permission(self, request, obj=None):
        return False

