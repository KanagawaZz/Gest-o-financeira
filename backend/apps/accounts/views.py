from django.db import transaction
from django.db.models import Q
from rest_framework import status
from rest_framework.response import Response

from apps.installments.models import InstallmentPlan
from apps.recurring.models import RecurringRule
from apps.transactions.models import Transaction
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
        account = self.get_object()
        with transaction.atomic():
            Transaction.objects.filter(
                owner=request.user
            ).filter(Q(account=account) | Q(destination_account=account)).delete()
            RecurringRule.objects.filter(owner=request.user, account=account).delete()
            InstallmentPlan.objects.filter(owner=request.user, account=account).delete()
            account.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
