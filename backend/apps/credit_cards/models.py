from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q


class CreditCard(models.Model):
    """Cartão. Nunca guarda número completo, CVV ou senha (plano §4.5)."""

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="credit_cards")
    name = models.CharField(max_length=60, help_text="Apelido do cartão.")
    institution = models.CharField(max_length=60, blank=True)
    credit_limit = models.DecimalField(max_digits=14, decimal_places=2)
    closing_day = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(31)])
    due_day = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(31)])
    color = models.CharField(max_length=7, default="#6D91B5")
    external_id = models.CharField(
        max_length=64, null=True, blank=True, help_text="Identificador externo do cartão (Open Finance / Pluggy)."
    )
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["owner", "name"], name="uniq_card_owner_name"),
            models.UniqueConstraint(
                fields=["owner", "external_id"],
                condition=Q(external_id__isnull=False),
                name="uniq_card_owner_external_id",
            ),
        ]

    def __str__(self):
        return self.name


class CreditCardInvoice(models.Model):
    """Fatura de um ciclo. (year, month) = mês de fechamento."""

    class Status(models.TextChoices):
        OPEN = "open", "Em aberto"
        PAID = "paid", "Paga"

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="credit_card_invoices")
    card = models.ForeignKey(CreditCard, on_delete=models.RESTRICT, related_name="invoices")
    year = models.PositiveSmallIntegerField()
    month = models.PositiveSmallIntegerField()
    closing_date = models.DateField()
    due_date = models.DateField()
    status = models.CharField(max_length=6, choices=Status.choices, default=Status.OPEN)
    paid_at = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ["-year", "-month"]
        constraints = [models.UniqueConstraint(fields=["card", "year", "month"], name="uniq_invoice_card_cycle")]

    def __str__(self):
        return f"{self.card} {self.month:02d}/{self.year}"
