from django.conf import settings
from django.db import models
from django.db.models import Q


class FinancialAccount(models.Model):
    """Conta bancária, carteira ou reserva. O saldo atual é derivado (ver services.py)."""

    class Type(models.TextChoices):
        CHECKING = "checking", "Conta corrente"
        WALLET = "wallet", "Carteira"
        SAVINGS = "savings", "Poupança/Reserva"
        INVESTMENT = "investment", "Investimentos"

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="financial_accounts")
    name = models.CharField(max_length=60)
    type = models.CharField(max_length=12, choices=Type.choices, default=Type.CHECKING)
    initial_balance = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    color = models.CharField(max_length=7, default="#6D91B5")
    external_id = models.CharField(
        max_length=64, null=True, blank=True, help_text="Identificador externo da conta (Open Finance / Pluggy)."
    )
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["owner", "name"], name="uniq_account_owner_name"),
            models.UniqueConstraint(
                fields=["owner", "external_id"],
                condition=Q(external_id__isnull=False),
                name="uniq_account_owner_external_id",
            ),
        ]

    def __str__(self):
        return self.name
