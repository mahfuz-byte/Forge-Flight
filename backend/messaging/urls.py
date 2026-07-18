from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register('conversations', views.ConversationViewSet, basename='conversation')
router.register('messages', views.MessageViewSet, basename='message')

urlpatterns = router.urls
