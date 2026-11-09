from django.conf import settings
from django.db import models


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
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["owner", "name"], name="uniq_account_owner_name"),
        ]

    def __str__(self):
        return self.name
