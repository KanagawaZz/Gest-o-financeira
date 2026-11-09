from rest_framework import serializers, viewsets

from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = ["id", "action", "model", "object_id", "changes", "created_at"]


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditLogSerializer

    def get_queryset(self):
        qs = AuditLog.objects.filter(owner=self.request.user)
        model = self.request.query_params.get("model")
        object_id = self.request.query_params.get("object_id")
        if model:
            qs = qs.filter(model=model)
        if object_id and object_id.isdigit():
            qs = qs.filter(object_id=int(object_id))
        return qs
