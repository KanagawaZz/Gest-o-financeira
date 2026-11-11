from decimal import Decimal

import re

from rest_framework import serializers

from apps.accounts.models import FinancialAccount
from apps.categories.models import Category
from apps.transactions.models import Transaction as T

from . import services
from .models import CreditCard, CreditCardInvoice

HEX = re.compile(r"^#[0-9A-Fa-f]{6}$")


class CreditCardSerializer(serializers.ModelSerializer):
    limit_used = serializers.SerializerMethodField()
    limit_available = serializers.SerializerMethodField()
    current_invoice = serializers.SerializerMethodField()

    class Meta:
        model = CreditCard
        fields = [
            "id", "name", "institution", "credit_limit", "closing_day", "due_day", "color", "is_archived",
            "limit_used", "limit_available", "current_invoice", "created_at",
        ]  # fmt: skip
        read_only_fields = ["id", "created_at"]

    def _used(self, obj) -> Decimal:
        from common.utilities.money import to_money

        annotated = getattr(obj, "annotated_limit_used", None)
        if annotated is not None:
            return to_money(annotated)
        cached = getattr(obj, "_cached_limit_used", None)
        if cached is None:
            cached = services.limit_used(obj)
            obj._cached_limit_used = cached
        return cached

    def get_limit_used(self, obj) -> str:
        return str(self._used(obj))

    def get_limit_available(self, obj) -> str:
        from common.utilities.money import to_money

        return str(to_money(obj.credit_limit - self._used(obj)))

    def get_current_invoice(self, obj) -> dict:
        return services.current_cycle(obj)

    def validate_credit_limit(self, value):
        if value <= 0:
            raise serializers.ValidationError("O limite deve ser maior que zero.")
        return value

    def validate_color(self, value):
        if not HEX.match(value):
            raise serializers.ValidationError("Use uma cor no formato #RRGGBB.")
        return value

    def validate_name(self, value):
        qs = CreditCard.objects.filter(owner=self.context["request"].user, name__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Já existe um cartão com esse apelido.")
        return value

    def validate(self, attrs):
        for key in ("closing_day", "due_day"):
            if key in attrs and not 1 <= attrs[key] <= 31:
                raise serializers.ValidationError({key: "Informe um dia entre 1 e 31."})
        return attrs


class InvoiceEntrySerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True, default=None)

    class Meta:
        model = T
        fields = ["id", "description", "amount", "date", "installment_number", "category_name", "status"]


class InvoiceSerializer(serializers.ModelSerializer):
    card_name = serializers.CharField(source="card.name", read_only=True)
    total = serializers.SerializerMethodField()
    payment_transaction = serializers.SerializerMethodField()

    class Meta:
        model = CreditCardInvoice
        fields = ["id", "card", "card_name", "year", "month", "closing_date", "due_date", "status", "paid_at", "total", "payment_transaction"]

    def get_total(self, obj) -> str:
        from common.utilities.money import to_money

        annotated = getattr(obj, "annotated_total", None)
        if annotated is not None:
            return str(to_money(annotated))
        return str(services.invoice_total(obj))

    def get_payment_transaction(self, obj) -> int | None:
        # Anotado pela view numa consulta só; fallback para instâncias isoladas.
        if hasattr(obj, "annotated_payment_id"):
            return obj.annotated_payment_id
        p = services.active_payment(obj).first()
        return p.pk if p else None


class InvoiceDetailSerializer(InvoiceSerializer):
    purchases = serializers.SerializerMethodField()

    class Meta(InvoiceSerializer.Meta):
        fields = InvoiceSerializer.Meta.fields + ["purchases"]

    def get_purchases(self, obj):
        return InvoiceEntrySerializer(services.invoice_entries(obj).select_related("category").order_by("date", "id"), many=True).data


class PurchaseInputSerializer(serializers.Serializer):
    description = serializers.CharField(max_length=120)
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0.01"))
    category = serializers.PrimaryKeyRelatedField(queryset=Category.objects.none())
    date = serializers.DateField()
    installments = serializers.IntegerField(min_value=1, max_value=120, default=1)
    notes = serializers.CharField(required=False, allow_blank=True, default="")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        owner = self.context["request"].user
        self.fields["category"].queryset = Category.objects.filter(owner=owner, kind=Category.Kind.EXPENSE, is_archived=False)


class PayInvoiceSerializer(serializers.Serializer):
    account = serializers.PrimaryKeyRelatedField(queryset=FinancialAccount.objects.none())
    date = serializers.DateField(required=False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["account"].queryset = FinancialAccount.objects.filter(owner=self.context["request"].user)
