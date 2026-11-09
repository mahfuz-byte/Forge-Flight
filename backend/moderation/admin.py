from django.contrib import admin

from .models import Report


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'target_type', 'target_repr', 'reason', 'status', 'reporter')
    list_filter = ('status', 'target_type', 'reason')
    search_fields = ('target_repr', 'target_id', 'details', 'reporter__email')
    raw_id_fields = ('reporter', 'handled_by')
