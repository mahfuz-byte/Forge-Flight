from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(['GET'])
def health_check(request):
    return Response({'status': 'ok'})


@api_view(['GET'])
@permission_classes([AllowAny])
def site(request):
    """Public platform switches the frontend needs (banner, which sign-in options to show)."""
    from .models import SiteSettings

    s = SiteSettings.current()
    return Response({
        'registration_open': s.registration_open,
        'google_signin_enabled': s.google_signin_enabled,
        'site_banner': s.site_banner,
    })


@api_view(['GET'])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def csrf(request):
    return Response({'csrfToken': get_token(request)})
