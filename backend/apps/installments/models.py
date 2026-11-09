from django.conf import settings
from django.db import models


class InstallmentPlan(models.Model):
    """Compra parcelada. As parcelas são lançamentos (Transaction) ligados ao plano:
    número, valor, vencimento, status e data de pagamento vivem no próprio lançamento,
    o que evita uma segunda fonte de verdade e a contagem em dobro."""

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="installment_plans")
    description = models.CharField(max_length=120)
    total_amount = models.DecimalField(max_digits=14, decimal_places=2)
    count = models.PositiveSmallIntegerField()
    first_date = models.DateField()
    category = models.ForeignKey("categories.Category", on_delete=models.RESTRICT, related_name="installment_plans")
    account = models.ForeignKey(
        "accounts.FinancialAccount", on_delete=models.RESTRICT, null=True, blank=True, related_name="installment_plans"
    )
    credit_card = models.ForeignKey(
        "credit_cards.CreditCard", on_delete=models.RESTRICT, null=True, blank=True, related_name="installment_plans"
    )
    notes = models.TextField(blank=True)
    early_payoff_at = models.DateField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.CheckConstraint(condition=models.Q(total_amount__gt=0), name="plan_total_positive"),
            models.CheckConstraint(condition=models.Q(count__gte=2), name="plan_min_two_installments"),
            models.CheckConstraint(
                condition=(models.Q(account__isnull=False, credit_card__isnull=True))
                | (models.Q(account__isnull=True, credit_card__isnull=False)),
                name="plan_account_xor_card",
            ),
        ]

    def __str__(self):
        return self.description
