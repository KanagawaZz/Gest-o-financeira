from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.response import Response

from apps.audit.services import record
from apps.credit_cards.services import Conflict
from apps.transactions.models import Transaction as T
from common.mixins import OwnedModelViewSet

from . import services
from .models import Goal, GoalContribution
from .serializers import ContributionInputSerializer, ContributionSerializer, GoalSerializer


class GoalViewSet(OwnedModelViewSet):
    queryset = Goal.objects.all()
    serializer_class = GoalSerializer
    search_fields = ["name"]

    def get_queryset(self):
        qs = super().get_queryset()
        archived = self.request.query_params.get("is_archived")
        if archived is not None:
            qs = qs.filter(is_archived=archived.lower() == "true")
        return qs

    def destroy(self, request, *args, **kwargs):
        goal = self.get_object()  # metas com contribuições são arquivadas
        goal.is_archived = True
        goal.save(update_fields=["is_archived"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get", "post"])
    def contributions(self, request, pk=None):
        goal = self.get_object()
        if request.method == "GET":
            qs = goal.contributions.select_related("transaction__account", "transaction__destination_account")
            return Response(ContributionSerializer(qs, many=True).data)
        data = ContributionInputSerializer(data=request.data, context={"request": request})
        data.is_valid(raise_exception=True)
        v = data.validated_data
        c = services.contribute(goal, amount=v["amount"], date=v["date"], account=v["account"], destination=v["destination_account"], notes=v["notes"])
        return Response(ContributionSerializer(c).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path=r"contributions/(?P<cid>\d+)/void")
    def void_contribution(self, request, pk=None, cid=None):
        """Estorna a contribuição: a transferência é estornada e o valor deixa de contar na meta."""
        goal = self.get_object()
        try:
            c = goal.contributions.select_related("transaction").get(pk=cid)
        except GoalContribution.DoesNotExist:
            raise NotFound()
        tx = c.transaction
        if tx.status != T.Status.REALIZED:
            raise Conflict("Apenas contribuições realizadas podem ser estornadas.")
        tx.status = T.Status.VOIDED
        tx.voided_at = timezone.now()
        tx.save(update_fields=["status", "voided_at", "updated_at"])
        record(request.user, "goal.contribution_voided", goal, {"transaction": tx.pk})
        return Response(ContributionSerializer(c).data)
