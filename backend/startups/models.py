from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.db import models
from django.utils.text import slugify


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
    file = models.FileField(upload_to='startup_docs/', blank=True, null=True)
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
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('declined', 'Declined'),
    ]

    startup = models.ForeignKey(Startup, on_delete=models.CASCADE, related_name='applications')
    applicant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='applications')
    role = models.CharField(max_length=140, blank=True)
    name = models.CharField(max_length=140, blank=True)
    email = models.EmailField(blank=True)
    link = models.URLField(blank=True)
    message = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.applicant} → {self.startup.name} ({self.status})'


class Investment(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
        ('completed', 'Completed'),
    ]

    startup = models.ForeignKey(Startup, on_delete=models.CASCADE, related_name='investments')
    investor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='investments')
    amount = models.PositiveIntegerField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.investor} → {self.startup.name}: {self.amount} ({self.status})'
