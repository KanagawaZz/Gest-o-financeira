from decimal import Decimal

from rest_framework import serializers

from apps.accounts.models import FinancialAccount

from . import services
from .models import Goal, GoalContribution


class GoalSerializer(serializers.ModelSerializer):
    progress = serializers.SerializerMethodField()

    class Meta:
        model = Goal
        fields = ["id", "name", "target_amount", "target_date", "priority", "description", "is_archived", "progress", "created_at"]
        read_only_fields = ["id", "created_at"]

    def get_progress(self, obj) -> dict:
        return services.progress(obj)

    def validate_target_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("O valor desejado deve ser maior que zero.")
        return value


class ContributionSerializer(serializers.ModelSerializer):
    amount = serializers.DecimalField(source="transaction.amount", max_digits=14, decimal_places=2, read_only=True)
    date = serializers.DateField(source="transaction.date", read_only=True)
    status = serializers.CharField(source="transaction.status", read_only=True)
    account_name = serializers.CharField(source="transaction.account.name", read_only=True)
    destination_account_name = serializers.CharField(source="transaction.destination_account.name", read_only=True)

    class Meta:
        model = GoalContribution
        fields = ["id", "transaction", "amount", "date", "status", "account_name", "destination_account_name", "created_at"]


class ContributionInputSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0.01"))
    date = serializers.DateField()
    account = serializers.PrimaryKeyRelatedField(queryset=FinancialAccount.objects.none())
    destination_account = serializers.PrimaryKeyRelatedField(queryset=FinancialAccount.objects.none())
    notes = serializers.CharField(required=False, allow_blank=True, default="")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        qs = FinancialAccount.objects.filter(owner=self.context["request"].user, is_archived=False)
        self.fields["account"].queryset = qs
        self.fields["destination_account"].queryset = qs
