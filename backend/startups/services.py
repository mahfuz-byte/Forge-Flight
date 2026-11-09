"""Business rules for applications, investments and funding (Phase 3).

Every state change goes through here so the rules live in one place and each
change runs in a single transaction with the rows it depends on locked
(BE-09). Views translate ``BusinessRuleError`` into a 400/409 response with
the message shown to the user (BE-10).
"""
from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.utils import timezone

from accounts.models import Role
from audit.log import record
from notifications.models import Notification

from .models import Application, CollaborationRole, Investment, Startup


class BusinessRuleError(Exception):
    """A request that is well-formed but not allowed right now."""

    def __init__(self, message, *, conflict=False, field=None):
        super().__init__(message)
        self.message = message
        self.conflict = conflict  # True → 409 (state changed / duplicate), else 400
        self.field = field


def _notify(user, text, link, icon='bell', color='var(--info)'):
    Notification.objects.create(recipient=user, text=text[:255], link=link[:140], icon=icon, color=color)


def _lock_startup(startup_id):
    return Startup.objects.select_for_update().get(pk=startup_id)


def can_manage_startup(user, startup):
    return startup.owner_id == user.id or user.has_role(Role.ADMIN)


# --------------------------------------------------------------- funding


def recalculate_funding(startup):
    """Recompute ``raised`` from real investments and auto-close a funded round (BE-04/05).

    Call inside a transaction with ``startup`` locked.
    """
    platform = (
        Investment.objects.filter(startup=startup, status__in=Investment.COUNTED_STATUSES)
        .aggregate(total=Sum('amount'))['total'] or 0
    )
    startup.raised = startup.external_raised + platform
    fields = ['raised', 'updated_at']
    if startup.goal and startup.raised >= startup.goal and startup.status != 'closed':
        startup.status = 'closed'
        startup.deadline = 'Funding closed'
        fields += ['status', 'deadline']
    startup.save(update_fields=fields)
    return startup


def validate_funding_settings(startup, goal=None, status=None):
    """Rules for what a founder may set on their round (BE-05/06)."""
    opening = status == 'open'  # explicitly asked to (re)open
    goal = startup.goal if goal is None else goal
    status = startup.status if status is None else status
    if status == 'open':
        if goal <= 0:
            raise BusinessRuleError('Set a funding goal before opening the round.', field='goal')
        # Lowering the goal of an open round to what's raised is fine: it just completes.
        if opening and startup.raised >= goal:
            raise BusinessRuleError(
                'This round is already fully funded. Raise the goal to reopen it.', field='goal',
            )


# --------------------------------------------------------------- investments


def create_investment(investor, startup, amount):
    """BE-03/08/09: validate and create an investment request."""
    if startup.owner_id == investor.id:
        raise BusinessRuleError("You can't invest in your own startup.")
    if not (Investment.MIN_AMOUNT <= amount <= Investment.MAX_AMOUNT):
        raise BusinessRuleError(
            f'Investment amount must be between ${Investment.MIN_AMOUNT:,} and ${Investment.MAX_AMOUNT:,}.',
            field='amount',
        )
    with transaction.atomic():
        startup = _lock_startup(startup.pk)
        if startup.status != 'open':
            raise BusinessRuleError('This startup is not accepting investments right now.')
        remaining = startup.goal - startup.raised
        if amount > remaining:
            raise BusinessRuleError(
                f'Only ${max(remaining, 0):,} of the funding goal is still open.', field='amount',
            )
        if Investment.objects.filter(startup=startup, investor=investor, status=Investment.PENDING).exists():
            raise BusinessRuleError(
                'You already have a pending request for this startup. Edit or withdraw it instead.',
                conflict=True,
            )
        try:
            with transaction.atomic():
                inv = Investment.objects.create(startup=startup, investor=investor, amount=amount)
        except IntegrityError:  # lost a race with a concurrent identical request
            raise BusinessRuleError('You already have a pending request for this startup.', conflict=True)
        _notify(
            startup.owner, f'New investment request of ${amount:,} for {startup.name}.',
            f'/dashboard/{startup.pk}', icon='coin', color='var(--success)',
        )
    record('investment.create', inv, amount=amount, startup=startup.pk)
    return inv


def change_investment_amount(inv, user, amount):
    if inv.investor_id != user.id:
        raise BusinessRuleError('Only the investor can change this request.')
    with transaction.atomic():
        startup = _lock_startup(inv.startup_id)
        inv = Investment.objects.select_for_update().get(pk=inv.pk)
        if inv.status != Investment.PENDING:
            raise BusinessRuleError(f'This request is already {inv.status}.', conflict=True)
        if not (Investment.MIN_AMOUNT <= amount <= Investment.MAX_AMOUNT):
            raise BusinessRuleError(
                f'Investment amount must be between ${Investment.MIN_AMOUNT:,} and ${Investment.MAX_AMOUNT:,}.',
                field='amount',
            )
        if amount > startup.goal - startup.raised:
            raise BusinessRuleError(
                f'Only ${max(startup.goal - startup.raised, 0):,} of the funding goal is still open.',
                field='amount',
            )
        old = inv.amount
        inv.amount = amount
        inv.save(update_fields=['amount', 'updated_at'])
    record('investment.update', inv, amount=[old, amount])
    return inv


def decide_investment(inv, user, accept, note=''):
    """Founder accepts or rejects a pending request; funding updates atomically (BE-02/04/09)."""
    with transaction.atomic():
        startup = _lock_startup(inv.startup_id)
        if not can_manage_startup(user, startup):
            raise PermissionError
        inv = Investment.objects.select_for_update().get(pk=inv.pk)
        if inv.status != Investment.PENDING:
            raise BusinessRuleError(f'This request was already {inv.status}.', conflict=True)
        if accept and startup.goal and startup.raised + inv.amount > startup.goal:
            raise BusinessRuleError(
                f'Accepting ${inv.amount:,} would exceed the funding goal '
                f'(${max(startup.goal - startup.raised, 0):,} left). Raise the goal or reject the request.',
                conflict=True,
            )
        inv.status = Investment.ACCEPTED if accept else Investment.REJECTED
        inv.decided_at = timezone.now()
        inv.decided_by = user
        inv.decision_note = (note or '')[:500]
        inv.save(update_fields=['status', 'decided_at', 'decided_by', 'decision_note', 'updated_at'])
        if accept:
            recalculate_funding(startup)
        verb = 'accepted' if accept else 'declined'
        _notify(
            inv.investor, f'{startup.name} {verb} your ${inv.amount:,} investment request.',
            f'/profile/{startup.pk}', icon='coin', color='var(--success)' if accept else 'var(--warning)',
        )
    record(f'investment.{inv.status}', inv, amount=inv.amount, startup=startup.pk, note=inv.decision_note)
    return inv


def withdraw_investment(inv, user):
    if inv.investor_id != user.id:
        raise BusinessRuleError('Only the investor can withdraw this request.')
    with transaction.atomic():
        inv = Investment.objects.select_for_update().get(pk=inv.pk)
        if inv.status != Investment.PENDING:
            raise BusinessRuleError(
                f'This request was already {inv.status} and can no longer be withdrawn.', conflict=True,
            )
        inv.status = Investment.WITHDRAWN
        inv.save(update_fields=['status', 'updated_at'])
    record('investment.withdrawn', inv, amount=inv.amount)
    return inv


# --------------------------------------------------------------- collaboration


def save_collaboration(startup, role, body, is_open):
    """Create or update the startup's collaboration listing (BE-07)."""
    role = (role or '').strip()
    body = (body or '').strip()
    if is_open and not role:
        raise BusinessRuleError('Give the role a title before publishing it.', field='role')
    if is_open and not body:
        raise BusinessRuleError('Describe the role before publishing it.', field='body')
    collab, _ = CollaborationRole.objects.update_or_create(
        startup=startup, defaults={'role': role[:140], 'body': body, 'is_open': is_open},
    )
    return collab


def create_application(applicant, startup, **fields):
    """BE-08: one live application per person, only to open listings, never to yourself."""
    if startup.owner_id == applicant.id:
        raise BusinessRuleError("You can't apply to your own startup.")
    collab = CollaborationRole.objects.filter(startup=startup).first()
    if collab is None or not collab.is_open:
        raise BusinessRuleError('This startup has no open collaboration role right now.')
    with transaction.atomic():
        if Application.objects.filter(
            startup=startup, applicant=applicant, status__in=Application.ACTIVE_STATUSES,
        ).exists():
            raise BusinessRuleError('You have already applied to this startup.', conflict=True)
        try:
            with transaction.atomic():
                app = Application.objects.create(
                    startup=startup, applicant=applicant, role=collab.role, **fields,
                )
        except IntegrityError:
            raise BusinessRuleError('You have already applied to this startup.', conflict=True)
        _notify(
            startup.owner, f'{app.name or applicant.name} applied for {collab.role} at {startup.name}.',
            f'/dashboard/{startup.pk}', icon='handshake', color='var(--warning)',
        )
    return app


def decide_application(app, user, accept):
    """BE-01: the startup owner accepts or declines a pending application."""
    with transaction.atomic():
        app = Application.objects.select_for_update().select_related('startup').get(pk=app.pk)
        if not can_manage_startup(user, app.startup):
            raise PermissionError
        if app.status != Application.PENDING:
            raise BusinessRuleError(f'This application was already {app.status}.', conflict=True)
        app.status = Application.ACCEPTED if accept else Application.DECLINED
        app.decided_at = timezone.now()
        app.decided_by = user
        app.save(update_fields=['status', 'decided_at', 'decided_by'])
        _notify(
            app.applicant, f'{app.startup.name} {app.status} your application for {app.role}.',
            f'/profile/{app.startup_id}', icon='handshake',
            color='var(--success)' if accept else 'var(--warning)',
        )
    record(f'application.{app.status}', app, startup=app.startup_id)
    return app


def withdraw_application(app, user):
    if app.applicant_id != user.id:
        raise BusinessRuleError('Only the applicant can withdraw this application.')
    with transaction.atomic():
        app = Application.objects.select_for_update().get(pk=app.pk)
        if app.status != Application.PENDING:
            raise BusinessRuleError(f'This application was already {app.status}.', conflict=True)
        app.status = Application.WITHDRAWN
        app.save(update_fields=['status'])
    return app
