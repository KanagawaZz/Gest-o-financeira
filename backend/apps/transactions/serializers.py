from rest_framework import serializers

from apps.accounts.models import FinancialAccount
from apps.categories.models import Category

from .models import Transaction

T = Transaction
WRITABLE_TYPES = [T.Type.INCOME, T.Type.EXPENSE, T.Type.TRANSFER]
# O que ainda se pode editar em compras de cartão e pagamentos de fatura (o resto vem da fatura).
CARD_EDITABLE = {"description", "category", "notes"}
PAYMENT_EDITABLE = {"description", "notes"}
INSTALLMENT_LOCKED = {"amount", "type", "destination_account"}


class TransactionSerializer(serializers.ModelSerializer):
    type = serializers.ChoiceField(choices=[(t, T.Type(t).label) for t in WRITABLE_TYPES] + [(T.Type.CARD_PAYMENT, "Pagamento de fatura")])
    category_name = serializers.CharField(source="category.name", read_only=True, default=None)
    category_color = serializers.CharField(source="category.color", read_only=True, default=None)
    account_name = serializers.CharField(source="account.name", read_only=True, default=None)
    destination_account_name = serializers.CharField(source="destination_account.name", read_only=True, default=None)
    credit_card_name = serializers.CharField(source="credit_card.name", read_only=True, default=None)
    status = serializers.ChoiceField(choices=[T.Status.PENDING, T.Status.REALIZED], required=False)

    class Meta:
        model = Transaction
        fields = [
            "id", "type", "description", "amount",
            "category", "category_name", "category_color",
            "account", "account_name", "destination_account", "destination_account_name",
            "credit_card", "credit_card_name", "invoice", "recurring_rule", "installment_plan", "installment_number",
            "is_estimate", "date", "competence_date", "settled_date", "status", "notes", "voided_at",
            "created_at", "updated_at",
        ]  # fmt: skip
        read_only_fields = [
            "id", "credit_card", "invoice", "recurring_rule", "installment_plan", "installment_number",
            "voided_at", "created_at", "updated_at",
        ]  # fmt: skip
        # As restrições únicas condicionais protegem linhas geradas pelo sistema (ocorrências, parcelas,
        # pagamento de fatura) e são garantidas pelo banco. Sem isto, o DRF as converte em validadores
        # que tornam `status` e `type` obrigatórios.
        validators = []

    def get_fields(self):
        fields = super().get_fields()
        owner = self.context["request"].user
        # Só é possível referenciar categorias e contas do próprio usuário.
        fields["category"].queryset = Category.objects.filter(owner=owner)
        fields["account"].queryset = FinancialAccount.objects.filter(owner=owner)
        fields["destination_account"].queryset = FinancialAccount.objects.filter(owner=owner)
        return fields

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("O valor deve ser maior que zero.")
        return value

    def validate(self, attrs):
        inst = self.instance
        if inst is None and attrs.get("type") == T.Type.CARD_PAYMENT:
            raise serializers.ValidationError({"type": "Pague a fatura pela tela de cartões."})
        if inst is not None and inst.status in (T.Status.VOIDED, T.Status.CANCELLED):
            raise serializers.ValidationError("Movimentações estornadas ou canceladas não podem ser alteradas.")

        # Lançamentos gerados por outros módulos só aceitam edição do que não quebra a origem.
        if inst is not None:
            if inst.type == T.Type.CARD_PAYMENT:
                bad = set(attrs) - PAYMENT_EDITABLE
            elif inst.credit_card_id:
                bad = set(attrs) - CARD_EDITABLE
            elif inst.installment_plan_id:
                bad = {k for k in attrs if k in INSTALLMENT_LOCKED and attrs[k] != getattr(inst, k)}
            else:
                bad = set()
            if bad:
                raise serializers.ValidationError({k: "Este campo não pode ser editado neste lançamento." for k in sorted(bad)})
            if inst.type == T.Type.CARD_PAYMENT:
                return attrs

        def value(key):
            return attrs[key] if key in attrs else getattr(inst, key, None)

        is_card_row = bool(inst and inst.credit_card_id)
        errors: dict[str, str] = {}
        tx_type, category = value("type"), value("category")
        account, dest = value("account"), value("destination_account")

        if account is None and not is_card_row:
            errors["account"] = "Escolha a conta."

        # Referências arquivadas só são aceitas se já eram as do registro.
        for key, obj in (("category", category), ("account", account), ("destination_account", dest)):
            if key in attrs and obj is not None and obj.is_archived and getattr(inst, f"{key}_id", None) != obj.pk:
                errors[key] = "Este item está arquivado."

        if tx_type == T.Type.TRANSFER:
            if category is not None:
                errors["category"] = "Transferências não têm categoria."
            if dest is None:
                errors["destination_account"] = "Informe a conta de destino."
            elif account is not None and dest.pk == account.pk:
                errors["destination_account"] = "A conta de destino deve ser diferente da origem."
        else:
            if dest is not None:
                errors["destination_account"] = "Só transferências têm conta de destino."
            if category is None:
                errors["category"] = "Informe a categoria."
            elif category.kind != tx_type:
                errors["category"] = "A categoria não corresponde ao tipo da movimentação."

        if errors:
            raise serializers.ValidationError(errors)
        if is_card_row:
            return attrs  # situação e datas vêm da fatura

        # Pendente não tem data efetiva; realizada assume a data da movimentação se não informada.
        status = attrs.get("status", inst.status if inst else T.Status.REALIZED)
        if status == T.Status.PENDING:
            attrs["settled_date"] = None
        elif attrs.get("settled_date") is None and (inst is None or inst.settled_date is None or "status" in attrs):
            attrs["settled_date"] = attrs.get("settled_date") or value("date")
        attrs["status"] = status
        if tx_type == T.Type.TRANSFER:
            attrs["category"] = None
        return attrs


class TransactionFilterSerializer(serializers.Serializer):
    """Valida os parâmetros de filtro da listagem (evita 500 com valores inválidos)."""

    type = serializers.ChoiceField(choices=T.Type.choices, required=False)
    status = serializers.ChoiceField(choices=T.Status.choices, required=False)
    category = serializers.IntegerField(required=False)
    account = serializers.IntegerField(required=False)
    credit_card = serializers.IntegerField(required=False)
    recurring_rule = serializers.IntegerField(required=False)
    installment_plan = serializers.IntegerField(required=False)
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
