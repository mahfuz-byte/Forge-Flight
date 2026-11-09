from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import SocialAccount, User


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


@admin.register(SocialAccount)
class SocialAccountAdmin(admin.ModelAdmin):
    list_display = ('user', 'provider', 'email', 'created_at', 'last_login_at')
    list_filter = ('provider',)
    search_fields = ('user__email', 'email', 'uid')
    raw_id_fields = ('user',)
    readonly_fields = ('provider', 'uid', 'email', 'created_at', 'last_login_at')
