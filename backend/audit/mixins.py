from accounts.permissions import resolve_path

from .log import record


class AuditStaffActionsMixin:
    """Log edits and deletions a staff member makes to content they don't own.

    For viewsets using ``IsOwnerOrReadOnly``: owners changing their own
    content is routine; a moderator or admin doing it is an audited action
    (``<audit_label>.staff_update`` / ``.staff_delete``).
    """

    audit_label = None

    def _audit_label(self):
        return self.audit_label or self.get_queryset().model._meta.model_name

    def audit_if_staff(self, instance, verb, **data):
        user = self.request.user
        owner_id = resolve_path(instance, getattr(self, 'owner_field', 'owner_id'))
        if owner_id != user.id:
            record(f'{self._audit_label()}.staff_{verb}', instance, owner_id=owner_id, **data)

    def perform_update(self, serializer):
        self.audit_if_staff(serializer.instance, 'update', fields=sorted(serializer.validated_data))
        super().perform_update(serializer)

    def perform_destroy(self, instance):
        self.audit_if_staff(instance, 'delete')  # before deleting, while the target still has a pk
        super().perform_destroy(instance)
