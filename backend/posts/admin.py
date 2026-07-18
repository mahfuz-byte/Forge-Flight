from django.contrib import admin

from .models import Post


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ('title', 'kind', 'startup', 'author', 'post_type', 'created_at')
    list_filter = ('kind', 'post_type')
    search_fields = ('title', 'text')
