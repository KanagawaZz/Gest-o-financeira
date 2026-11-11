from decimal import Decimal

from django.db.models import DecimalField, Q, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.installments.services import create_plan
from apps.transactions.models import Transaction as T
from apps.transactions.serializers import TransactionSerializer
from common.mixins import OwnedModelViewSet

from . import services
from .models import CreditCard, CreditCardInvoice
from .serializers import (
    CreditCardSerializer,
    InvoiceDetailSerializer,
    InvoiceSerializer,
    PayInvoiceSerializer,
    PurchaseInputSerializer,
)


class CreditCardViewSet(OwnedModelViewSet):
    queryset = CreditCard.objects.all()
    serializer_class = CreditCardSerializer
    search_fields = ["name", "institution"]

    def get_queryset(self):
        qs = super().get_queryset().annotate(
            annotated_limit_used=Coalesce(
                Sum("purchases__amount", filter=Q(purchases__type=T.Type.EXPENSE, purchases__status=T.Status.PENDING)),
                Decimal("0"),
                output_field=DecimalField(),
            )
        )
        archived = self.request.query_params.get("is_archived")
        if archived is not None:
            qs = qs.filter(is_archived=archived.lower() == "true")
        return qs

    def destroy(self, request, *args, **kwargs):
        card = self.get_object()  # cartões com histórico são arquivados, nunca apagados
        card.is_archived = True
        card.save(update_fields=["is_archived"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def purchases(self, request, pk=None):
        """Compra no cartão (à vista = 1 parcela) ou parcelada. Não altera saldo: entra na fatura."""
        card = self.get_object()
        data = PurchaseInputSerializer(data=request.data, context={"request": request})
        data.is_valid(raise_exception=True)
        v = data.validated_data
        if v["installments"] == 1:
            created = [services.add_purchase(card, description=v["description"], amount=v["amount"], category=v["category"], date=v["date"], notes=v["notes"])]
        else:
            plan = create_plan(
                request.user, description=v["description"], total_amount=v["amount"], count=v["installments"],
                first_date=v["date"], category=v["category"], card=card, notes=v["notes"],
            )  # fmt: skip
            created = list(plan.installments.order_by("installment_number"))
        ctx = self.get_serializer_context()
        return Response(TransactionSerializer(created, many=True, context=ctx).data, status=status.HTTP_201_CREATED)


class InvoiceViewSet(viewsets.ReadOnlyModelViewSet):
    ordering = ["-year", "-month"]

    def get_queryset(self):
        qs = (
            CreditCardInvoice.objects.filter(owner=self.request.user)
            .select_related("card")
            .annotate(
                annotated_total=Coalesce(
                    Sum(
                        "entries__amount",
                        filter=Q(entries__type=T.Type.EXPENSE) & ~Q(entries__status__in=[T.Status.CANCELLED, T.Status.VOIDED]),
                    ),
                    Decimal("0"),
                    output_field=DecimalField(),
                )
            )
        )
        p = self.request.query_params
        if p.get("card", "").isdigit():
            qs = qs.filter(card_id=int(p["card"]))
        if p.get("status") in CreditCardInvoice.Status.values:
            qs = qs.filter(status=p["status"])
        return qs

    def get_serializer_class(self):
        return InvoiceDetailSerializer if self.action == "retrieve" else InvoiceSerializer

    @action(detail=True, methods=["post"])
    def pay(self, request, pk=None):
        invoice = self.get_object()
        data = PayInvoiceSerializer(data=request.data, context={"request": request})
        data.is_valid(raise_exception=True)
        services.pay_invoice(invoice, data.validated_data["account"], data.validated_data.get("date") or timezone.localdate())
        invoice.refresh_from_db()
        return Response(InvoiceDetailSerializer(invoice, context=self.get_serializer_context()).data)
