from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models.functions import Lower

from .managers import UserManager, normalize_email


class Role(models.TextChoices):
    """Platform roles (AUTH-09).

    Being a startup owner is *not* a role: it is a relationship (Startup.owner)
    checked per object. Roles only describe platform-level authority.
    """

    USER = 'user', 'User'
    SUPPORT_ADMIN = 'support_admin', 'Support Admin'
    MODERATOR = 'moderator', 'Moderator'
    FINANCE_ADMIN = 'finance_admin', 'Finance Admin'
    ADMIN = 'admin', 'Admin'
    SUPER_ADMIN = 'super_admin', 'Super Admin'


ADMIN_ROLES = frozenset(r for r in Role.values if r != Role.USER)
# Roles allowed to moderate community content (posts, comments, reports).
MODERATION_ROLES = frozenset({Role.MODERATOR, Role.ADMIN, Role.SUPER_ADMIN})


class User(AbstractUser):
    """A person's account. Startups are pages a User creates and owns, not a role."""

    username = None
    email = models.EmailField(unique=True)
    slug = models.SlugField(unique=True, blank=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.USER)
    email_verified = models.BooleanField(default=False)
    
    # General Profile
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    headline = models.CharField(max_length=120, blank=True)
    bio = models.TextField(blank=True)
    location = models.CharField(max_length=120, blank=True)
    
    # Collaborator Profile
    resume = models.FileField(upload_to='resumes/', null=True, blank=True)
    skills = models.CharField(max_length=255, blank=True) # Comma-separated list
    experience_level = models.CharField(max_length=50, blank=True)
    portfolio_link = models.URLField(blank=True)
    
    # Investor Profile
    investor_type = models.CharField(max_length=50, blank=True)
    investment_budget = models.CharField(max_length=100, blank=True)
    investment_interests = models.CharField(max_length=255, blank=True)

    saved_startups = models.ManyToManyField(
        'startups.Startup', related_name='saved_by', blank=True,
    )
    followed_startups = models.ManyToManyField(
        'startups.Startup', related_name='followed_by', blank=True,
    )

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta(AbstractUser.Meta):
        constraints = [
            models.UniqueConstraint(Lower('email'), name='user_email_ci_unique'),
        ]

    def __str__(self):
        return self.name or self.email

    @property
    def name(self):
        return self.get_full_name() or self.email

    @property
    def initials(self):
        parts = self.name.split()
        return ''.join(p[0] for p in parts if p).upper()[:3] or '?'

    @property
    def is_platform_admin(self):
        return self.is_active and (self.is_superuser or self.role in ADMIN_ROLES)

    def has_role(self, *roles):
        """True if the user holds any of ``roles``. Super admins hold every role."""
        if not self.is_active:
            return False
        if self.is_superuser or self.role == Role.SUPER_ADMIN:
            return True
        return self.role in roles

    @property
    def can_moderate(self):
        return self.has_role(*MODERATION_ROLES)

    def save(self, *args, **kwargs):
        self.email = normalize_email(self.email)
        if not self.slug:
            from django.utils.text import slugify
            base = slugify(self.name) or 'user'
            slug = base
            n = 2
            while User.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f'{base}-{n}'
                n += 1
            self.slug = slug
        super().save(*args, **kwargs)


class SocialAccount(models.Model):
    """An external identity (e.g. Google) linked to a local User (AUTH-02/03).

    External providers only prove identity. Roles, permissions, sessions and
    account status always come from the local User row.
    """

    PROVIDER_GOOGLE = 'google'
    PROVIDER_CHOICES = [(PROVIDER_GOOGLE, 'Google')]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='social_accounts')
    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES)
    # The provider's stable subject id ("sub"). Never key on email: it can change.
    uid = models.CharField(max_length=255)
    email = models.EmailField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_login_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['provider', 'uid'], name='social_provider_uid_unique'),
            models.UniqueConstraint(fields=['user', 'provider'], name='social_user_provider_unique'),
        ]

    def __str__(self):
        return f'{self.provider}:{self.email or self.uid} → {self.user}'
