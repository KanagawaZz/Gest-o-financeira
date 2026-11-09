from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response

from apps.audit.services import record
from common.mixins import OwnedModelViewSet
from common.utilities.dates import add_months

from . import services
from .models import RecurringRule
from .serializers import RecurringRuleSerializer

HORIZON_MONTHS = 24


class RecurringRuleViewSet(OwnedModelViewSet):
    queryset = RecurringRule.objects.select_related("category", "account")
    serializer_class = RecurringRuleSerializer
    search_fields = ["description"]
    ordering_fields = ["description", "start_date", "amount"]

    def get_queryset(self):
        qs = super().get_queryset()
        active = self.request.query_params.get("is_active")
        if active is not None:
            qs = qs.filter(is_active=active.lower() == "true")
        return qs

    def _horizon(self):
        return add_months(timezone.localdate(), HORIZON_MONTHS)

    def perform_create(self, serializer):
        serializer.validated_data.pop("apply_to_future", None)
        rule = serializer.save(owner=self.request.user)
        services.ensure_generated(self.request.user, self._horizon())
        record(self.request.user, "rule.created", rule)

    def perform_update(self, serializer):
        apply = serializer.validated_data.pop("apply_to_future", False)
        was_active = serializer.instance.is_active
        rule = serializer.save()
        changes = {"apply_to_future": apply}
        if not rule.is_active and was_active:
            changes["cancelled_future"] = services.cancel_future(rule)
        elif rule.is_active:
            if apply:
                changes["updated_occurrences"] = services.apply_to_future(rule)
            if rule.end_date:
                changes["cancelled_after_end"] = services.cancel_future(rule, after=rule.end_date)
            services.ensure_generated(self.request.user, self._horizon())
        record(self.request.user, "rule.updated", rule, changes)

    def destroy(self, request, *args, **kwargs):
        # Encerrar a regra: cancela só o que é futuro e pendente; o histórico permanece.
        rule = self.get_object()
        cancelled = services.cancel_future(rule)
        rule.is_active = False
        rule.save(update_fields=["is_active"])
        record(request.user, "rule.ended", rule, {"cancelled_future": cancelled})
        return Response(status=status.HTTP_204_NO_CONTENT)
