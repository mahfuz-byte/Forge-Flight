from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import Role, SocialAccount, User

# Fields that grant authority. Only super admins may change them (SEC-09).
PRIVILEGE_FIELDS = ('role', 'is_staff', 'is_superuser', 'groups', 'user_permissions')


def _is_super_admin(user):
    return user.is_active and user.has_role(Role.SUPER_ADMIN)


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    model = User
    list_display = ('email', 'first_name', 'last_name', 'role', 'is_active', 'email_verified')
    list_filter = ('role', 'is_active', 'email_verified', 'is_staff')
    search_fields = ('email', 'first_name', 'last_name', 'slug')
    ordering = ('email',)
    fieldsets = (
        (None, {'fields': ('email', 'password', 'email_verified')}),
        ('Personal info', {'fields': ('first_name', 'last_name', 'bio', 'location', 'slug')}),
        ('Startups', {'fields': ('saved_startups', 'followed_startups')}),
        ('Permissions', {'fields': ('role', 'is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'first_name', 'last_name', 'password1', 'password2'),
        }),
    )
    filter_horizontal = ('groups', 'user_permissions', 'saved_startups', 'followed_startups')

    def get_readonly_fields(self, request, obj=None):
        fields = list(super().get_readonly_fields(request, obj))
        if not _is_super_admin(request.user):
            fields += PRIVILEGE_FIELDS
        return fields

    def _touches_privileged_account(self, request, obj):
        # Staff below super admin can't edit or delete accounts above them.
        return obj is not None and not _is_super_admin(request.user) and (
            obj.is_superuser or obj.role == Role.SUPER_ADMIN or obj.is_staff
        ) and obj.pk != request.user.pk

    def has_change_permission(self, request, obj=None):
        if self._touches_privileged_account(request, obj):
            return False
        return super().has_change_permission(request, obj)

    def has_delete_permission(self, request, obj=None):
        if self._touches_privileged_account(request, obj) or (obj is not None and obj.pk == request.user.pk):
            return False
        return super().has_delete_permission(request, obj)


@admin.register(SocialAccount)
class SocialAccountAdmin(admin.ModelAdmin):
    list_display = ('user', 'provider', 'email', 'created_at', 'last_login_at')
    list_filter = ('provider',)
    search_fields = ('user__email', 'email', 'uid')
    raw_id_fields = ('user',)
    readonly_fields = ('provider', 'uid', 'email', 'created_at', 'last_login_at')
