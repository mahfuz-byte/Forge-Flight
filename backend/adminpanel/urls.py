from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register('admin/activity', views.AdminActivityViewSet, basename='admin-activity')

urlpatterns = [
    path('admin/me/', views.AdminMeView.as_view(), name='admin-me'),
    path('admin/dashboard/', views.AdminDashboardView.as_view(), name='admin-dashboard'),
    *router.urls,
]
