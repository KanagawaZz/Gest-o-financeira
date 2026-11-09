from django.conf import settings
from django.db import models


class Goal(models.Model):
    class Priority(models.TextChoices):
        LOW = "low", "Baixa"
        MEDIUM = "medium", "Média"
        HIGH = "high", "Alta"

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="goals")
    name = models.CharField(max_length=80)
    target_amount = models.DecimalField(max_digits=14, decimal_places=2)
    target_date = models.DateField(null=True, blank=True)
    priority = models.CharField(max_length=6, choices=Priority.choices, default=Priority.MEDIUM)
    description = models.TextField(blank=True)
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["is_archived", "target_date", "name"]
        constraints = [models.CheckConstraint(condition=models.Q(target_amount__gt=0), name="goal_target_positive")]

    def __str__(self):
        return self.name


class GoalContribution(models.Model):
    """Dinheiro guardado: só existe com uma transferência real vinculada (plano §4.7)."""

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="goal_contributions")
    goal = models.ForeignKey(Goal, on_delete=models.RESTRICT, related_name="contributions")
    transaction = models.OneToOneField(
        "transactions.Transaction", on_delete=models.RESTRICT, related_name="goal_contribution"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
