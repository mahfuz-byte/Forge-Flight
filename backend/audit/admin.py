from django.contrib import admin

from accounts.models import Role

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """Read-only view of the audit trail, for super admins only (SEC-10)."""

    list_display = ('created_at', 'actor_email', 'actor_role', 'action', 'target_type', 'target_repr', 'ip')
    list_filter = ('action', 'actor_role', 'target_type')
    search_fields = ('actor_email', 'action', 'target_repr', 'target_id', 'ip')
    date_hierarchy = 'created_at'
    readonly_fields = [f.name for f in AuditLog._meta.fields]

    def has_module_permission(self, request):
        return request.user.is_active and request.user.has_role(Role.SUPER_ADMIN)

    def has_view_permission(self, request, obj=None):
        return self.has_module_permission(request)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
