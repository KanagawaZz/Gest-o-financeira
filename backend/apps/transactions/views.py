from datetime import timedelta

from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.exceptions import APIException
from rest_framework.response import Response

from apps.audit.services import diff, record
from apps.credit_cards.services import reopen_invoice
from apps.recurring.services import ensure_generated
from common.mixins import OwnedModelViewSet
from common.utilities.money import ZERO, to_money

from .models import Transaction
from .serializers import TransactionFilterSerializer, TransactionSerializer


class Conflict(APIException):
    status_code = 409
    default_code = "conflict"
    default_detail = "A operação não é permitida no estado atual do registro."


class TransactionViewSet(OwnedModelViewSet):
    queryset = Transaction.objects.select_related("category", "account", "destination_account", "credit_card")
    serializer_class = TransactionSerializer
    search_fields = ["description", "notes"]
    ordering_fields = ["date", "amount", "created_at"]
    ordering = ["-date", "-id"]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.action not in ("list", "summary"):
            return qs
        f = TransactionFilterSerializer(data=self.request.query_params)
        f.is_valid(raise_exception=True)
        p = f.validated_data
        # Garante as ocorrências recorrentes do período consultado (idempotente).
        ensure_generated(self.request.user, p.get("date_to") or timezone.localdate() + timedelta(days=90))
        if "type" in p:
            qs = qs.filter(type=p["type"])
        if "status" in p:
            qs = qs.filter(status=p["status"])
        else:
            qs = qs.exclude(status=Transaction.Status.CANCELLED)
        for key, column in (("category", "category_id"), ("credit_card", "credit_card_id"),
                            ("recurring_rule", "recurring_rule_id"), ("installment_plan", "installment_plan_id")):  # fmt: skip
            if key in p:
                qs = qs.filter(**{column: p[key]})
        if "account" in p:
            qs = qs.filter(Q(account_id=p["account"]) | Q(destination_account_id=p["account"]))
        if "date_from" in p:
            qs = qs.filter(date__gte=p["date_from"])
        if "date_to" in p:
            qs = qs.filter(date__lte=p["date_to"])
        return qs

    def perform_update(self, serializer):
        changes = diff(serializer.instance, serializer.validated_data)
        tx = serializer.save()
        if changes:
            record(self.request.user, "transaction.updated", tx, changes)

    def perform_create(self, serializer):
        tx = serializer.save(owner=self.request.user)
        record(self.request.user, "transaction.created", tx, {"type": tx.type, "amount": str(tx.amount)})

    def destroy(self, request, *args, **kwargs):
        tx = self.get_object()
        if tx.status != Transaction.Status.PENDING:
            raise Conflict("Movimentações realizadas ou estornadas não podem ser excluídas. Use o estorno.")
        # Pendências geradas por regra, parcelamento ou cartão são canceladas (não apagadas):
        # a geração recorrente e o plano não podem recriá-las nem perder a numeração.
        if tx.recurring_rule_id or tx.installment_plan_id or tx.credit_card_id:
            tx.status = Transaction.Status.CANCELLED
            tx.save(update_fields=["status", "updated_at"])
            record(request.user, "transaction.cancelled", tx)
            return Response(status=204)
        record(request.user, "transaction.deleted", tx, {"description": tx.description, "amount": str(tx.amount)})
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def void(self, request, pk=None):
        """Estorna uma movimentação realizada: sai do saldo, mas permanece no histórico."""
        tx = self.get_object()
        if tx.status != Transaction.Status.REALIZED:
            raise Conflict("Apenas movimentações realizadas podem ser estornadas.")
        if tx.credit_card_id:
            raise Conflict("Compras no cartão são liquidadas pela fatura. Estorne o pagamento da fatura.")
        tx.status = Transaction.Status.VOIDED
        tx.voided_at = timezone.now()
        tx.save(update_fields=["status", "voided_at", "updated_at"])
        if tx.type == Transaction.Type.CARD_PAYMENT and tx.invoice_id:
            reopen_invoice(tx)
        record(request.user, "transaction.voided", tx, {"amount": str(tx.amount)})
        return Response(self.get_serializer(tx).data)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        """Totais do conjunto filtrado (visão de consumo).

        Transferências, pagamentos de fatura, estornadas e canceladas ficam de fora: a compra no
        cartão já conta como despesa, e pagar a fatura não pode contar de novo.
        """
        qs = self.filter_queryset(self.get_queryset()).filter(type__in=[Transaction.Type.INCOME, Transaction.Type.EXPENSE])
        qs = qs.exclude(status__in=[Transaction.Status.VOIDED, Transaction.Status.CANCELLED])

        def total(**kw):
            return str(to_money(qs.filter(**kw).aggregate(t=Sum("amount"))["t"] or ZERO))

        R, P = Transaction.Status.REALIZED, Transaction.Status.PENDING
        I, E = Transaction.Type.INCOME, Transaction.Type.EXPENSE
        return Response(
            {
                "income_realized": total(type=I, status=R),
                "income_pending": total(type=I, status=P),
                "expense_realized": total(type=E, status=R),
                "expense_pending": total(type=E, status=P),
            }
        )
