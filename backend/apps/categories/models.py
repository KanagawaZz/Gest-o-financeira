from django.conf import settings
from django.db import models


class Category(models.Model):
    class Kind(models.TextChoices):
        EXPENSE = "expense", "Despesa"
        INCOME = "income", "Receita"

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="categories")
    name = models.CharField(max_length=60)
    kind = models.CharField(max_length=10, choices=Kind.choices)
    color = models.CharField(max_length=7, default="#6D91B5")
    icon = models.CharField(max_length=40, default="tag")
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["kind", "name"]
        verbose_name_plural = "categories"
        constraints = [
            models.UniqueConstraint(fields=["owner", "kind", "name"], name="uniq_category_owner_kind_name"),
        ]

    def __str__(self):
        return f"{self.name} ({self.kind})"
