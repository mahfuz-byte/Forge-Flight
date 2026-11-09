from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .managers import normalize_email
from .models import SocialAccount, User

PUBLIC_PROFILE_FIELDS = [
    'id', 'slug', 'name', 'first_name', 'last_name', 'initials',
    'bio', 'location', 'avatar', 'headline', 'skills', 'experience_level',
    'portfolio_link', 'investor_type', 'investment_interests',
]


class PublicUserSerializer(serializers.ModelSerializer):
    """What other people may see about a user (AUTH-11). No email, no private lists."""

    name = serializers.ReadOnlyField()
    initials = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = PUBLIC_PROFILE_FIELDS
        read_only_fields = fields


class UserSerializer(serializers.ModelSerializer):
    """The signed-in user's own account (/auth/me/)."""

    name = serializers.ReadOnlyField()
    initials = serializers.ReadOnlyField()
    has_password = serializers.SerializerMethodField()
    google_linked = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = PUBLIC_PROFILE_FIELDS + [
            'email', 'email_verified', 'role', 'has_password', 'google_linked',
            'saved_startups', 'followed_startups', 'resume', 'investment_budget',
        ]
        # Email changes need a verification flow before they can be allowed;
        # role is only ever assigned by admins.
        read_only_fields = [
            'id', 'slug', 'email', 'email_verified', 'role',
            'saved_startups', 'followed_startups',
        ]

    def get_has_password(self, obj):
        return obj.has_usable_password()

    def get_google_linked(self, obj):
        return obj.social_accounts.filter(provider=SocialAccount.PROVIDER_GOOGLE).exists()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'email', 'password', 'bio', 'location']
        extra_kwargs = {'email': {'validators': []}}  # uniqueness checked case-insensitively below

    def validate_email(self, value):
        email = normalize_email(value)
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return email

    def validate(self, attrs):
        candidate = User(**{k: v for k, v in attrs.items() if k != 'password'})
        validate_password(attrs['password'], user=candidate)
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        return User.objects.create_user(password=password, **validated_data)


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, required=False, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        user = self.context['request'].user
        # Google-only accounts have no password yet and may set one directly.
        if user.has_usable_password() and not user.check_password(attrs.get('current_password', '')):
            raise serializers.ValidationError({'current_password': 'Current password is incorrect.'})
        validate_password(attrs['new_password'], user=user)
        return attrs
