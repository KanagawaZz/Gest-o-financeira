from rest_framework import status
from rest_framework.response import Response

from common.mixins import OwnedModelViewSet

from .models import FinancialAccount
from .serializers import FinancialAccountSerializer
from .services import balances_for_owner


class FinancialAccountViewSet(OwnedModelViewSet):
    queryset = FinancialAccount.objects.all()
    serializer_class = FinancialAccountSerializer
    search_fields = ["name"]
    ordering_fields = ["name", "created_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        archived = self.request.query_params.get("is_archived")
        if archived is not None:
            qs = qs.filter(is_archived=archived.lower() == "true")
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.request and self.request.user.is_authenticated and self.action == "list":
            ctx["balances"] = balances_for_owner(self.request.user)
        return ctx

    def destroy(self, request, *args, **kwargs):
        # Contas com histórico não podem sumir: arquivar preserva os lançamentos.
        account = self.get_object()
        account.is_archived = True
        account.save(update_fields=["is_archived"])
        return Response(status=status.HTTP_204_NO_CONTENT)
