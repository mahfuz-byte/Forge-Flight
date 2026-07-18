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
    inlines = [CollaborationRoleInline, TeamMemberInline, TimelineEventInline, DocumentInline, UpdateEntryInline]


@admin.register(StartupComment)
class StartupCommentAdmin(admin.ModelAdmin):
    list_display = ('startup', 'author', 'created_at')
    search_fields = ('text',)


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ('startup', 'applicant', 'role', 'status', 'created_at')
    list_filter = ('status',)


@admin.register(Investment)
class InvestmentAdmin(admin.ModelAdmin):
    list_display = ('startup', 'investor', 'amount', 'status', 'created_at')
    list_filter = ('status',)
