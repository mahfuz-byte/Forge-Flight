from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.db import models
from django.utils.text import slugify

from core.uploads import RandomFilename, validate_startup_document


class Startup(models.Model):
    STATUS_CHOICES = [
        ('open', 'Funding Open'),
        ('soon', 'Opening Soon'),
        ('closed', 'Funding Closed'),
    ]

    slug = models.SlugField(primary_key=True, max_length=140)
    name = models.CharField(max_length=140)
    initials = models.CharField(max_length=4, blank=True)
    verified = models.BooleanField(default=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='startups')
    tagline = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='soon')
    tags = ArrayField(models.CharField(max_length=40), blank=True, default=list)
    goal = models.PositiveIntegerField(default=0)
    # Funding raised before/outside the platform. Set by staff, not founders.
    external_raised = models.PositiveIntegerField(default=0)
    # external_raised + accepted platform investments. Maintained by
    # startups.services.recalculate_funding; never written by clients (BE-04).
    raised = models.PositiveIntegerField(default=0)
    deadline = models.CharField(max_length=60, blank=True, default='Opening soon')
    overview = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name) or 'startup'
            slug = base
            n = 2
            while Startup.objects.filter(slug=slug).exists():
                slug = f'{base}-{n}'
                n += 1
            self.slug = slug
        if not self.initials:
            parts = self.name.split()
            self.initials = ''.join(p[0] for p in parts if p).upper()[:3]
        super().save(*args, **kwargs)

    @property
    def funding_pct(self):
        return round((self.raised / self.goal) * 100) if self.goal else 0


class CollaborationRole(models.Model):
    startup = models.OneToOneField(Startup, on_delete=models.CASCADE, related_name='collab')
    role = models.CharField(max_length=140)
    body = models.TextField()
    # Unpublished listings stay saved but don't accept applications (BE-07).
    is_open = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.role} @ {self.startup.name}'


class TeamMember(models.Model):
    startup = models.ForeignKey(Startup, on_delete=models.CASCADE, related_name='team')
    name = models.CharField(max_length=140)
    title = models.CharField(max_length=140)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return f'{self.name} — {self.title}'


class TimelineEvent(models.Model):
    startup = models.ForeignKey(Startup, on_delete=models.CASCADE, related_name='timeline')
    date_label = models.CharField(max_length=40)
    title = models.CharField(max_length=140)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return f'{self.startup.name}: {self.title}'


class Document(models.Model):
    startup = models.ForeignKey(Startup, on_delete=models.CASCADE, related_name='docs')
    name = models.CharField(max_length=140)
    size = models.CharField(max_length=20, blank=True)
    file = models.FileField(
        upload_to=RandomFilename('startup_docs'), blank=True, null=True,
        validators=[validate_startup_document],
    )
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return self.name


class UpdateEntry(models.Model):
    startup = models.ForeignKey(Startup, on_delete=models.CASCADE, related_name='updates')
    text = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.text[:60]


class StartupComment(models.Model):
    startup = models.ForeignKey(Startup, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='startup_comments')
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'{self.author}: {self.text[:40]}'


class Application(models.Model):
    PENDING, ACCEPTED, DECLINED, WITHDRAWN = 'pending', 'accepted', 'declined', 'withdrawn'
    STATUS_CHOICES = [
        (PENDING, 'Pending'),
        (ACCEPTED, 'Accepted'),
        (DECLINED, 'Declined'),
        (WITHDRAWN, 'Withdrawn'),
    ]
    ACTIVE_STATUSES = (PENDING, ACCEPTED)

    startup = models.ForeignKey(Startup, on_delete=models.CASCADE, related_name='applications')
    applicant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='applications')
    role = models.CharField(max_length=140, blank=True)
    name = models.CharField(max_length=140, blank=True)
    email = models.EmailField(blank=True)
    link = models.URLField(blank=True)
    message = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+',
    )

    class Meta:
        ordering = ['-created_at']
        constraints = [
            # One live application per person per startup (BE-08).
            models.UniqueConstraint(
                fields=['startup', 'applicant'], condition=models.Q(status__in=('pending', 'accepted')),
                name='one_active_application_per_startup',
            ),
        ]

    def __str__(self):
        return f'{self.applicant} → {self.startup.name} ({self.status})'


class Investment(models.Model):
    PENDING, ACCEPTED, REJECTED, WITHDRAWN, COMPLETED = 'pending', 'accepted', 'rejected', 'withdrawn', 'completed'
    STATUS_CHOICES = [
        (PENDING, 'Pending'),
        (ACCEPTED, 'Accepted'),
        (REJECTED, 'Rejected'),
        (WITHDRAWN, 'Withdrawn'),
        (COMPLETED, 'Completed'),
    ]
    # Statuses whose amount counts toward Startup.raised.
    COUNTED_STATUSES = (ACCEPTED, COMPLETED)

    MIN_AMOUNT = 100
    MAX_AMOUNT = 10_000_000

    startup = models.ForeignKey(Startup, on_delete=models.CASCADE, related_name='investments')
    investor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='investments')
    amount = models.PositiveIntegerField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # Decision history: kept instead of deleting the request (BE-02).
    decided_at = models.DateTimeField(null=True, blank=True)
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+',
    )
    decision_note = models.CharField(max_length=500, blank=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            # One open request per investor per startup (BE-08).
            models.UniqueConstraint(
                fields=['startup', 'investor'], condition=models.Q(status='pending'),
                name='one_pending_investment_per_startup',
            ),
            models.CheckConstraint(condition=models.Q(amount__gt=0), name='investment_amount_positive'),
        ]

    def __str__(self):
        return f'{self.investor} → {self.startup.name}: {self.amount} ({self.status})'
