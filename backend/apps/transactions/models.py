from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import F, Q


class Transaction(models.Model):
    """Livro-caixa único: receita, despesa, transferência e pagamento de fatura.

    Regras que sustentam todo o sistema:
    - Só movimentações `realized` COM conta alteram saldo.
    - `pending` = previsto/compromisso. Parcelas e contas recorrentes são lançamentos pendentes.
    - Compra no cartão (`credit_card` preenchido, sem conta) é despesa de consumo; NÃO altera saldo.
      O dinheiro sai quando a fatura é paga (`card_payment`), que NÃO é consumo.
    - Transferência é um registro origem -> destino e não é receita nem despesa.
    - Realizada não se exclui: estorna-se (`voided`). Pendente ligada a regra/plano/cartão é
      `cancelled` (nunca apagada), para a geração recorrente não recriá-la.
    """

    class Type(models.TextChoices):
        INCOME = "income", "Receita"
        EXPENSE = "expense", "Despesa"
        TRANSFER = "transfer", "Transferência"
        CARD_PAYMENT = "card_payment", "Pagamento de fatura"

    class Status(models.TextChoices):
        PENDING = "pending", "Pendente"
        REALIZED = "realized", "Realizada"
        VOIDED = "voided", "Estornada"
        CANCELLED = "cancelled", "Cancelada"

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="transactions")
    type = models.CharField(max_length=12, choices=Type.choices)
    description = models.CharField(max_length=120)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    category = models.ForeignKey(
        "categories.Category", on_delete=models.RESTRICT, null=True, blank=True, related_name="transactions"
    )
    account = models.ForeignKey(
        "accounts.FinancialAccount", on_delete=models.RESTRICT, null=True, blank=True, related_name="transactions"
    )
    destination_account = models.ForeignKey(
        "accounts.FinancialAccount",
        on_delete=models.RESTRICT,
        null=True,
        blank=True,
        related_name="incoming_transfers",
    )
    credit_card = models.ForeignKey(
        "credit_cards.CreditCard", on_delete=models.RESTRICT, null=True, blank=True, related_name="purchases"
    )
    invoice = models.ForeignKey(
        "credit_cards.CreditCardInvoice", on_delete=models.RESTRICT, null=True, blank=True, related_name="entries"
    )
    recurring_rule = models.ForeignKey(
        "recurring.RecurringRule", on_delete=models.RESTRICT, null=True, blank=True, related_name="occurrences"
    )
    installment_plan = models.ForeignKey(
        "installments.InstallmentPlan", on_delete=models.RESTRICT, null=True, blank=True, related_name="installments"
    )
    installment_number = models.PositiveSmallIntegerField(null=True, blank=True)
    is_estimate = models.BooleanField(default=False, help_text="Valor estimado, não garantido.")
    date = models.DateField(help_text="Data da movimentação / vencimento.")
    competence_date = models.DateField(null=True, blank=True)
    settled_date = models.DateField(null=True, blank=True, help_text="Data efetiva de pagamento/recebimento.")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.REALIZED)
    notes = models.TextField(blank=True)
    voided_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-id"]
        indexes = [
            models.Index(fields=["owner", "date"]),
            models.Index(fields=["owner", "account", "status"]),
            models.Index(fields=["owner", "status", "date"]),
        ]
        constraints = [
            models.CheckConstraint(condition=Q(amount__gt=Decimal("0")), name="transaction_amount_positive"),
            models.CheckConstraint(
                condition=(
                    Q(type="transfer", destination_account__isnull=False, category__isnull=True)
                    | (~Q(type="transfer") & Q(destination_account__isnull=True))
                ),
                name="transaction_transfer_shape",
            ),
            models.CheckConstraint(
                condition=Q(destination_account__isnull=True) | ~Q(destination_account=F("account")),
                name="transaction_transfer_distinct_accounts",
            ),
            # Ou é movimento de conta, ou é compra de cartão (despesa, sem conta).
            models.CheckConstraint(
                condition=(Q(account__isnull=False, credit_card__isnull=True))
                | (Q(account__isnull=True, credit_card__isnull=False, type="expense")),
                name="transaction_account_xor_card",
            ),
            # Idempotência: uma ocorrência por regra/data, uma parcela por número, um pagamento por fatura.
            models.UniqueConstraint(
                fields=["recurring_rule", "date"],
                condition=Q(recurring_rule__isnull=False),
                name="uniq_occurrence_rule_date",
            ),
            models.UniqueConstraint(
                fields=["installment_plan", "installment_number"],
                condition=Q(installment_plan__isnull=False),
                name="uniq_installment_number",
            ),
            models.UniqueConstraint(
                fields=["invoice"],
                condition=Q(type="card_payment") & ~Q(status="voided"),
                name="uniq_active_invoice_payment",
            ),
        ]

    def __str__(self):
        return f"{self.get_type_display()} {self.amount} - {self.description}"
