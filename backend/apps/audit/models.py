from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    """Histórico imutável de alterações relevantes (plano §6.5)."""

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="audit_logs")
    action = models.CharField(max_length=40)
    model = models.CharField(max_length=40)
    object_id = models.BigIntegerField(null=True, blank=True)
    changes = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["owner", "model", "object_id"])]

    def __str__(self):
        return f"{self.action} {self.model}#{self.object_id}"
