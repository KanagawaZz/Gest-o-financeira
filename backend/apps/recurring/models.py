from django.conf import settings
from django.db import models


class RecurringRule(models.Model):
    """Regra de recorrência. Gera lançamentos *pendentes* (Transaction) de forma idempotente."""

    class Frequency(models.TextChoices):
        WEEKLY = "weekly", "Semanal"
        MONTHLY = "monthly", "Mensal"
        YEARLY = "yearly", "Anual"
        CUSTOM = "custom", "Personalizada (a cada N dias)"

    class Kind(models.TextChoices):
        INCOME = "income", "Receita"
        EXPENSE = "expense", "Despesa"

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="recurring_rules")
    description = models.CharField(max_length=120)
    type = models.CharField(max_length=10, choices=Kind.choices, default=Kind.EXPENSE)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    category = models.ForeignKey("categories.Category", on_delete=models.RESTRICT, related_name="recurring_rules")
    account = models.ForeignKey("accounts.FinancialAccount", on_delete=models.RESTRICT, related_name="recurring_rules")
    frequency = models.CharField(max_length=10, choices=Frequency.choices, default=Frequency.MONTHLY)
    interval_days = models.PositiveSmallIntegerField(null=True, blank=True)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    variable = models.BooleanField(default=False, help_text="Valor estimado (não garantido) nas projeções.")
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["description"]
        constraints = [
            models.CheckConstraint(condition=models.Q(amount__gt=0), name="recurring_amount_positive"),
        ]

    def __str__(self):
        return self.description
