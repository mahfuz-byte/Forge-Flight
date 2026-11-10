from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.response import Response
from rest_framework.settings import api_settings
from rest_framework.throttling import SimpleRateThrottle

from audit.log import record
from core.models import SiteSettings

from . import throttling
from .google import GoogleAuthError, verify_google_credential
from .managers import normalize_email
from .models import SocialAccount, User
from .serializers import (
    ChangePasswordSerializer,
    PublicUserSerializer,
    RegisterSerializer,
    UserSerializer,
)


class AuthThrottle(SimpleRateThrottle):
    """Per-IP limit shared by every credential-checking endpoint (AUTH-08)."""

    scope = 'auth'

    def get_rate(self):
        # Read live settings (DRF snapshots THROTTLE_RATES at import time).
        return api_settings.DEFAULT_THROTTLE_RATES[self.scope]

    def get_cache_key(self, request, view):
        return self.cache_format % {'scope': self.scope, 'ident': self.get_ident(request)}


class UserViewSet(viewsets.ReadOnlyModelViewSet):
    """Public profiles. Listing requires sign-in so the directory can't be scraped (AUTH-11)."""

    queryset = User.objects.filter(is_active=True).order_by('id')
    serializer_class = PublicUserSerializer
    lookup_field = 'slug'

    def get_permissions(self):
        if self.action == 'list':
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]


def _start_session(request, user, status_code=200, **extra):
    login(request, user, backend='django.contrib.auth.backends.ModelBackend')
    return Response({**UserSerializer(user).data, **extra}, status=status_code)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@throttle_classes([AuthThrottle])
def register(request):
    if not SiteSettings.current().registration_open:
        return Response({'detail': 'New sign-ups are paused right now. Please try again later.'}, status=403)
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    try:
        user = serializer.save()
    except IntegrityError:  # lost a race with a concurrent registration
        return Response({'email': ['An account with this email already exists.']}, status=400)
    return _start_session(request, user, status_code=201)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@throttle_classes([AuthThrottle])
def login_view(request):
    email = normalize_email(request.data.get('email'))
    password = request.data.get('password') or ''
    if not email or not password:
        return Response({'detail': 'Email and password are required.'}, status=400)

    if throttling.is_locked_out(email):
        record('auth.login_locked_out', email=email)
        return Response(
            {'detail': 'Too many failed attempts. Try again in a few minutes.'},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    user = authenticate(request, username=email, password=password)
    if user is None:
        throttling.record_failure(email)
        record('auth.login_failed', email=email)
        return Response({'detail': 'Invalid credentials.'}, status=400)

    throttling.clear_failures(email)
    record('auth.login', user, actor=user, method='password')
    return _start_session(request, user)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def logout_view(request):
    if request.user.is_authenticated:
        record('auth.logout', request.user)
    logout(request)  # flushes the server-side session and rotates the CSRF token
    return Response(status=204)


@api_view(['GET', 'PATCH'])
@permission_classes([permissions.IsAuthenticated])
def me(request):
    if request.method == 'PATCH':
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
    return Response(UserSerializer(request.user).data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@throttle_classes([AuthThrottle])
def change_password(request):
    serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
    serializer.is_valid(raise_exception=True)
    user = request.user
    had_password = user.has_usable_password()
    user.set_password(serializer.validated_data['new_password'])
    user.save(update_fields=['password'])
    record('auth.password_changed', user, had_password=had_password)
    # Other sessions are invalidated by the new password hash; keep this one.
    update_session_auth_hash(request, user)
    request.session.cycle_key()
    return Response(status=204)


# ---------------------------------------------------------------- Google OAuth


def _link_google(user, identity):
    social, _ = SocialAccount.objects.update_or_create(
        provider=SocialAccount.PROVIDER_GOOGLE, uid=identity.sub,
        defaults={'user': user, 'email': normalize_email(identity.email), 'last_login_at': timezone.now()},
    )
    if not user.email_verified and normalize_email(identity.email) == user.email:
        user.email_verified = True
        user.save(update_fields=['email_verified'])
    return social


def _inactive_response():
    return Response({'detail': 'This account is disabled.', 'code': 'account_disabled'}, status=403)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@throttle_classes([AuthThrottle])
def google_login(request):
    """Sign in (or sign up) with a Google ID token from Google Identity Services.

    Outcomes:
      200      session started (linked account, or existing account auto-linked by email)
      201      session started for a newly created account
      409      the matching account already has a *different* Google account linked
      400/403  invalid token, unverified Google email, or disabled account
    """
    if not SiteSettings.current().google_signin_enabled:
        return Response({'detail': 'Google sign-in is turned off right now. Use your email and password.'}, status=403)
    try:
        identity = verify_google_credential(request.data.get('credential'))
    except GoogleAuthError as exc:
        record('auth.google_failed', reason=str(exc))
        return Response({'detail': str(exc)}, status=400)

    if not identity.email_verified:
        return Response({'detail': 'Your Google email address is not verified.'}, status=400)

    email = normalize_email(identity.email)

    # 1. Already linked → sign in as that user (subject id, never email, is the key).
    social = (
        SocialAccount.objects.select_related('user')
        .filter(provider=SocialAccount.PROVIDER_GOOGLE, uid=identity.sub)
        .first()
    )
    if social:
        if not social.user.is_active:
            return _inactive_response()
        social.last_login_at = timezone.now()
        social.save(update_fields=['last_login_at'])
        record('auth.login', social.user, actor=social.user, method='google')
        return _start_session(request, social.user)

    # 2. Signed in already → this is an explicit "connect Google" action.
    if request.user.is_authenticated:
        if SocialAccount.objects.filter(user=request.user, provider=SocialAccount.PROVIDER_GOOGLE).exists():
            return Response({'detail': 'A different Google account is already linked.'}, status=409)
        _link_google(request.user, identity)
        record('auth.google_linked', request.user, google_email=email)
        return Response(UserSerializer(request.user).data)

    existing = User.objects.filter(email__iexact=email).first()

    # 3. An account with this email exists but isn't linked yet. Google has just
    #    proven the person controls this mailbox, so link automatically. The
    #    account keeps its password: Google and email/password both keep working.
    if existing:
        if not existing.is_active:
            return _inactive_response()
        if SocialAccount.objects.filter(user=existing, provider=SocialAccount.PROVIDER_GOOGLE).exists():
            return Response({'detail': 'A different Google account is already linked to this account.'}, status=409)
        _link_google(existing, identity)
        record('auth.google_linked', existing, actor=existing, google_email=email, automatic=True)
        record('auth.login', existing, actor=existing, method='google')
        return _start_session(request, existing)

    # 4. New user → create a fully initialised local account.
    if not SiteSettings.current().registration_open:
        return Response({'detail': 'New sign-ups are paused right now. Please try again later.'}, status=403)
    with transaction.atomic():
        user = User.objects.create_user(
            email=email,
            password=None,  # unusable password; they can set one later
            first_name=identity.given_name[:150],
            last_name=identity.family_name[:150],
            email_verified=True,
        )
        _link_google(user, identity)
    record('auth.login', user, actor=user, method='google', new_account=True)
    return _start_session(request, user, status_code=201, created=True)

