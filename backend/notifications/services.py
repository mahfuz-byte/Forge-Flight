"""Creating notifications from real events (FE-03)."""
from .models import Notification

COLORS = {
    'success': 'var(--success)',
    'warning': 'var(--warning)',
    'info': 'var(--info)',
    'accent': 'var(--accent)',
}


def notify(recipient, text, link='/feed', icon='bell', color='info', actor=None):
    """Send ``recipient`` a notification. No-op when people act on their own things."""
    if recipient is None or (actor is not None and actor.pk == recipient.pk):
        return None
    if not recipient.is_active:
        return None
    return Notification.objects.create(
        recipient=recipient, text=text[:255], link=link[:140], icon=icon,
        color=COLORS.get(color, color),
    )
