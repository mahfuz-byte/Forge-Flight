"""Audit hooks that fire however a change is made (API, Django admin, shell)."""
from django.contrib.admin.models import ADDITION, CHANGE, DELETION, LogEntry
from django.contrib.auth import get_user_model
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from .log import current_request, record

User = get_user_model()

# Account fields whose changes are security-relevant.
WATCHED_USER_FIELDS = ('role', 'is_active', 'is_staff', 'is_superuser', 'email')


@receiver(pre_save, sender=User)
def _remember_user_state(sender, instance, update_fields=None, **kwargs):
    if update_fields is not None and not set(update_fields) & set(WATCHED_USER_FIELDS):
        instance._audit_old = None  # e.g. last_login bump on sign-in: nothing to watch
    elif instance.pk:
        old = sender.objects.filter(pk=instance.pk).values(*WATCHED_USER_FIELDS).first()
        instance._audit_old = old
    else:
        instance._audit_old = None


@receiver(post_save, sender=User)
def _audit_user_change(sender, instance, created, **kwargs):
    if created:
        request = current_request()
        actor = getattr(request, 'user', None) if request is not None else None
        # Self sign-up has no signed-in actor yet: the new user is the actor.
        if not getattr(actor, 'is_authenticated', False):
            actor = instance
        record('user.created', instance, actor=actor, role=instance.role)
        return

    old = getattr(instance, '_audit_old', None)
    if not old:
        return
    changes = {
        f: [old[f], getattr(instance, f)]
        for f in WATCHED_USER_FIELDS
        if old[f] != getattr(instance, f)
    }
    if not changes:
        return
    if 'role' in changes or 'is_staff' in changes or 'is_superuser' in changes:
        action = 'user.privileges_changed'
    elif 'is_active' in changes:
        action = 'user.activated' if instance.is_active else 'user.deactivated'
    else:
        action = 'user.email_changed'
    record(action, instance, changes=changes)


@receiver(post_delete, sender=User)
def _audit_user_delete(sender, instance, **kwargs):
    record('user.deleted', instance, email=instance.email)


_ADMIN_ACTIONS = {ADDITION: 'admin.add', CHANGE: 'admin.change', DELETION: 'admin.delete'}


@receiver(post_save, sender=LogEntry)
def _mirror_django_admin(sender, instance, created, **kwargs):
    """Copy every Django admin add/change/delete into the audit log."""
    if not created:
        return
    ct = instance.content_type
    record(
        _ADMIN_ACTIONS.get(instance.action_flag, 'admin.action'),
        actor=instance.user,
        # Referenced by id/repr: for a deletion the object is already gone.
        target_ref=(f'{ct.app_label}.{ct.model}' if ct else '', instance.object_id or '', instance.object_repr),
        message=instance.get_change_message(),
    )
