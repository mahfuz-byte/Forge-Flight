from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """A person's account. Startups are pages a User creates and owns, not a role."""

    username = None
    email = models.EmailField(unique=True)
    slug = models.SlugField(unique=True, blank=True)
    bio = models.TextField(blank=True)
    location = models.CharField(max_length=120, blank=True)

    saved_startups = models.ManyToManyField(
        'startups.Startup', related_name='saved_by', blank=True,
    )
    followed_startups = models.ManyToManyField(
        'startups.Startup', related_name='followed_by', blank=True,
    )

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.name or self.email

    @property
    def name(self):
        return self.get_full_name() or self.email

    @property
    def initials(self):
        parts = self.name.split()
        return ''.join(p[0] for p in parts if p).upper()[:3] or '?'

    def save(self, *args, **kwargs):
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
