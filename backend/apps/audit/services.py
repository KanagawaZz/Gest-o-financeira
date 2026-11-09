from .models import AuditLog


def record(owner, action: str, obj=None, changes: dict | None = None, *, model: str | None = None, object_id=None):
    """Registra um evento de auditoria. Valores monetários ficam só no banco, nunca em logs de aplicação."""
    return AuditLog.objects.create(
        owner=owner,
        action=action,
        model=model or (type(obj).__name__ if obj is not None else ""),
        object_id=object_id if object_id is not None else getattr(obj, "pk", None),
        changes=changes or {},
    )


def diff(instance, new_values: dict) -> dict:
    """{campo: [antes, depois]} apenas para o que mudou (valores convertidos para texto)."""
    out = {}
    for field, new in new_values.items():
        old = getattr(instance, f"{field}_id", None) if hasattr(instance, f"{field}_id") else getattr(instance, field, None)
        new_cmp = getattr(new, "pk", new)
        if str(old) != str(new_cmp):
            out[field] = [None if old is None else str(old), None if new_cmp is None else str(new_cmp)]
    return out
