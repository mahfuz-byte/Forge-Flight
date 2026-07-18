from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register('startups', views.StartupViewSet, basename='startup')
router.register('comments', views.StartupCommentViewSet, basename='startup-comment')
router.register('applications', views.ApplicationViewSet, basename='application')
router.register('investments', views.InvestmentViewSet, basename='investment')

urlpatterns = router.urls
