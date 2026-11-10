from django.urls import path
from rest_framework.routers import SimpleRouter

from . import community, operations, startups, users, views

router = SimpleRouter()
router.register('admin/activity', views.AdminActivityViewSet, basename='admin-activity')
router.register('admin/users', users.AdminUserViewSet, basename='admin-users')
router.register('admin/staff', users.AdminStaffViewSet, basename='admin-staff')
router.register('admin/startups', startups.AdminStartupViewSet, basename='admin-startups')
router.register('admin/investments', startups.AdminInvestmentViewSet, basename='admin-investments')
router.register('admin/collaborations', startups.AdminCollaborationViewSet, basename='admin-collaborations')
router.register('admin/posts', community.AdminPostViewSet, basename='admin-posts')
router.register('admin/comments', community.AdminCommentViewSet, basename='admin-comments')
router.register('admin/reports', community.AdminReportViewSet, basename='admin-reports')
router.register('admin/announcements', operations.AdminAnnouncementViewSet, basename='admin-announcements')

urlpatterns = [
    path('admin/me/', views.AdminMeView.as_view(), name='admin-me'),
    path('admin/dashboard/', views.AdminDashboardView.as_view(), name='admin-dashboard'),
    path('admin/roles/', users.AdminRolesView.as_view(), name='admin-roles'),
    path('admin/announcements/preview/', operations.AnnouncementPreviewView.as_view(), name='admin-announcement-preview'),
    path('admin/analytics/', operations.AdminAnalyticsView.as_view(), name='admin-analytics'),
    path('admin/analytics/export/', operations.AdminAnalyticsExportView.as_view(), name='admin-analytics-export'),
    path('admin/settings/', operations.AdminSettingsView.as_view(), name='admin-settings'),
    *router.urls,
]
