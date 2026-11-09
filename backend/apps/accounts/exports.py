"""Exportação completa dos dados do usuário (cópia pessoal / portabilidade)."""
import json

from django.core.serializers.json import DjangoJSONEncoder
from django.utils import timezone


def export_user_data(user) -> bytes:
    from apps.accounts.models import FinancialAccount
    from apps.audit.models import AuditLog
    from apps.categories.models import Category
    from apps.credit_cards.models import CreditCard, CreditCardInvoice
    from apps.goals.models import Goal, GoalContribution
    from apps.installments.models import InstallmentPlan
    from apps.recurring.models import RecurringRule
    from apps.transactions.models import Transaction

    def rows(model):
        return list(model.objects.filter(owner=user).values())

    payload = {
        "exported_at": timezone.now().isoformat(),
        "app": "NEXO",
        "version": 1,
        "user": {"username": user.username, "first_name": user.first_name, "email": user.email},
        "accounts": rows(FinancialAccount),
        "categories": rows(Category),
        "transactions": rows(Transaction),
        "recurring_rules": rows(RecurringRule),
        "credit_cards": rows(CreditCard),
        "credit_card_invoices": rows(CreditCardInvoice),
        "installment_plans": rows(InstallmentPlan),
        "goals": rows(Goal),
        "goal_contributions": rows(GoalContribution),
        "audit_log": rows(AuditLog),
    }
    return json.dumps(payload, cls=DjangoJSONEncoder, ensure_ascii=False, indent=2).encode("utf-8")
