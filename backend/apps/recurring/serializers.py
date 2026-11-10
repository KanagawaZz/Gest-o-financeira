from django.db.models import Min, Q
from rest_framework import serializers

from apps.accounts.models import FinancialAccount
from apps.categories.models import Category
from apps.transactions.models import Transaction as T

from .models import RecurringRule

IMMUTABLE_ON_UPDATE = ("frequency", "interval_days", "start_date", "type")


class RecurringRuleSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    account_name = serializers.CharField(source="account.name", read_only=True)
    next_due = serializers.SerializerMethodField()
    apply_to_future = serializers.BooleanField(write_only=True, required=False, default=False)

    class Meta:
        model = RecurringRule
        fields = [
            "id", "description", "type", "amount", "category", "category_name", "account", "account_name",
            "frequency", "interval_days", "start_date", "end_date", "variable", "is_active", "notes",
            "next_due", "apply_to_future", "created_at",
        ]  # fmt: skip
        read_only_fields = ["id", "created_at"]

    def get_fields(self):
        fields = super().get_fields()
        user = self.context["request"].user
        # Sem login (geração offline do schema OpenAPI): nenhuma opção, em vez de filtrar por AnonymousUser.
        owner = user if user.is_authenticated else None
        fields["category"].queryset = Category.objects.filter(owner=owner)
        fields["account"].queryset = FinancialAccount.objects.filter(owner=owner)
        return fields

    def get_next_due(self, obj) -> str | None:
        d = obj.occurrences.filter(status=T.Status.PENDING).aggregate(d=Min("date"))["d"]
        return d.isoformat() if d else None

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("O valor deve ser maior que zero.")
        return value

    def validate(self, attrs):
        inst = self.instance

        def value(key):
            return attrs[key] if key in attrs else getattr(inst, key, None)

        errors: dict[str, str] = {}
        if inst is not None:
            for key in IMMUTABLE_ON_UPDATE:
                if key in attrs and attrs[key] != getattr(inst, key):
                    errors[key] = "Não pode ser alterado depois de criada. Encerre esta regra e crie outra."

        freq, interval = value("frequency"), value("interval_days")
        if freq == RecurringRule.Frequency.CUSTOM:
            if not interval or interval < 1:
                errors["interval_days"] = "Informe a cada quantos dias a regra se repete."
        elif interval:
            errors["interval_days"] = "Só use esta opção na frequência personalizada."

        start, end = value("start_date"), value("end_date")
        if start and end and end < start:
            errors["end_date"] = "A data final não pode ser anterior à inicial."

        category, account = value("category"), value("account")
        if category is not None and category.kind != value("type"):
            errors["category"] = "A categoria não corresponde ao tipo."
        for key, obj in (("category", category), ("account", account)):
            if key in attrs and obj.is_archived and getattr(inst, f"{key}_id", None) != obj.pk:
                errors[key] = "Este item está arquivado."
        if errors:
            raise serializers.ValidationError(errors)
        return attrs


# usado nos testes/filtros
def pending_q():
    return Q(status=T.Status.PENDING)
