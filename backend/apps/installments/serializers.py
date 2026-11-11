from decimal import Decimal

from rest_framework import serializers

from apps.accounts.models import FinancialAccount
from apps.categories.models import Category
from apps.credit_cards.models import CreditCard
from apps.transactions.models import Transaction as T

from .models import InstallmentPlan


class InstallmentRowSerializer(serializers.ModelSerializer):
    class Meta:
        model = T
        fields = ["id", "installment_number", "amount", "date", "status", "settled_date"]


class InstallmentPlanSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    account_name = serializers.CharField(source="account.name", read_only=True, default=None)
    credit_card_name = serializers.CharField(source="credit_card.name", read_only=True, default=None)
    status = serializers.SerializerMethodField()
    paid_count = serializers.SerializerMethodField()
    pending_count = serializers.SerializerMethodField()
    remaining_amount = serializers.SerializerMethodField()
    progress_percent = serializers.SerializerMethodField()

    class Meta:
        model = InstallmentPlan
        fields = [
            "id", "description", "total_amount", "count", "first_date", "category", "category_name",
            "account", "account_name", "credit_card", "credit_card_name", "notes", "status",
            "paid_count", "pending_count", "remaining_amount", "progress_percent",
            "early_payoff_at", "created_at",
        ]  # fmt: skip
        read_only_fields = ["id", "status", "early_payoff_at", "created_at"]

    def get_fields(self):
        fields = super().get_fields()
        user = self.context["request"].user
        # Sem login (geração offline do schema OpenAPI): nenhuma opção, em vez de filtrar por AnonymousUser.
        owner = user if user.is_authenticated else None
        fields["category"].queryset = Category.objects.filter(owner=owner, kind=Category.Kind.EXPENSE, is_archived=False)
        fields["account"].queryset = FinancialAccount.objects.filter(owner=owner, is_archived=False)
        fields["credit_card"].queryset = CreditCard.objects.filter(owner=owner, is_archived=False)
        return fields

    # Valores anotados pela view (1 consulta); fallback para instâncias isoladas.
    def _agg(self, obj, name, default):
        return getattr(obj, name, default)

    def get_paid_count(self, obj) -> int:
        return self._agg(obj, "paid_count", obj.installments.filter(status=T.Status.REALIZED).count())

    def get_pending_count(self, obj) -> int:
        return self._agg(obj, "pending_count", obj.installments.filter(status=T.Status.PENDING).count())

    def get_remaining_amount(self, obj) -> str:
        from django.db.models import Sum
        from common.utilities.money import to_money

        default = obj.installments.filter(status=T.Status.PENDING).aggregate(t=Sum("amount"))["t"] or Decimal("0")
        return str(to_money(self._agg(obj, "remaining_amount", default)))

    def get_progress_percent(self, obj) -> int:
        return round(100 * self.get_paid_count(obj) / obj.count)

    def get_status(self, obj) -> str:
        if obj.cancelled_at:
            return "cancelled"
        return "finished" if self.get_pending_count(obj) == 0 else "active"

    def validate_total_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("O valor total deve ser maior que zero.")
        return value

    def validate_count(self, value):
        if not 2 <= value <= 120:
            raise serializers.ValidationError("Informe de 2 a 120 parcelas.")
        return value

    def validate(self, attrs):
        if self.instance is not None:
            locked = {"total_amount", "count", "first_date", "category", "account", "credit_card"}
            bad = locked & set(attrs)
            if bad:
                raise serializers.ValidationError({k: "Não pode ser alterado depois de criado." for k in bad})
            return attrs
        if bool(attrs.get("account")) == bool(attrs.get("credit_card")):
            raise serializers.ValidationError({"account": "Informe a conta OU o cartão da compra."})
        return attrs


class InstallmentPlanDetailSerializer(InstallmentPlanSerializer):
    installments = serializers.SerializerMethodField()

    class Meta(InstallmentPlanSerializer.Meta):
        fields = InstallmentPlanSerializer.Meta.fields + ["installments"]

    def get_installments(self, obj):
        rows = obj.installments.order_by("installment_number")  # sempre por número da parcela
        return InstallmentRowSerializer(rows, many=True).data
