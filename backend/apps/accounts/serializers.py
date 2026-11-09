import re

from rest_framework import serializers

from .models import FinancialAccount
from .services import balances_for_owner

HEX = re.compile(r"^#[0-9A-Fa-f]{6}$")


class FinancialAccountSerializer(serializers.ModelSerializer):
    current_balance = serializers.SerializerMethodField()

    class Meta:
        model = FinancialAccount
        fields = ["id", "name", "type", "initial_balance", "current_balance", "color", "is_archived", "created_at"]
        read_only_fields = ["id", "created_at", "current_balance"]

    def get_current_balance(self, obj) -> str:
        # A lista calcula os saldos uma vez só (contexto); criação/edição recalcula.
        balances = self.context.get("balances")
        if balances is None or obj.pk not in balances:
            balances = balances_for_owner(obj.owner)
        return str(balances[obj.pk])

    def validate_color(self, value):
        if not HEX.match(value):
            raise serializers.ValidationError("Use uma cor no formato #RRGGBB.")
        return value

    def validate_name(self, value):
        owner = self.context["request"].user
        qs = FinancialAccount.objects.filter(owner=owner, name__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Já existe uma conta com esse nome.")
        return value
