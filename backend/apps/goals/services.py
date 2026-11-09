from datetime import date
from decimal import ROUND_CEILING, Decimal

from django.db import transaction as db_transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.audit.services import record
from apps.transactions.models import Transaction as T
from common.utilities.dates import month_index
from common.utilities.money import ZERO, to_money

from .models import Goal, GoalContribution


def saved_amount(goal: Goal) -> Decimal:
    """Só conta dinheiro com movimentação real (transferência realizada) vinculada."""
    qs = GoalContribution.objects.filter(goal=goal, transaction__status=T.Status.REALIZED)
    return to_money(qs.aggregate(t=Sum("transaction__amount"))["t"] or ZERO)


def progress(goal: Goal, today: date | None = None) -> dict:
    today = today or timezone.localdate()
    saved = saved_amount(goal)
    remaining = max(goal.target_amount - saved, ZERO)
    pct = min(100, int(saved * 100 / goal.target_amount)) if goal.target_amount else 0
    months_left = monthly_needed = None
    if goal.target_date and remaining > 0:
        months_left = max(1, month_index(goal.target_date, today))  # meta vencida: tudo no próximo mês
        monthly_needed = (remaining / months_left).quantize(Decimal("0.01"), rounding=ROUND_CEILING)
    return {
        "current_amount": str(saved), "remaining_amount": str(to_money(remaining)), "progress_percent": pct,
        "months_left": months_left, "monthly_needed": str(monthly_needed) if monthly_needed is not None else None,
    }  # fmt: skip


@db_transaction.atomic
def contribute(goal: Goal, *, amount, date, account, destination, notes="") -> GoalContribution:
    """Guarda dinheiro: cria a transferência real (conta -> reserva) e a vincula à meta."""
    if goal.is_archived:
        raise ValidationError({"detail": "Meta arquivada."})
    if account.pk == destination.pk:
        raise ValidationError({"destination_account": "A reserva deve ser uma conta diferente da origem."})
    tx = T.objects.create(
        owner=goal.owner, type=T.Type.TRANSFER, description=f"Meta: {goal.name}", amount=to_money(amount),
        account=account, destination_account=destination, date=date, settled_date=date,
        status=T.Status.REALIZED, notes=notes,
    )  # fmt: skip
    contribution = GoalContribution.objects.create(owner=goal.owner, goal=goal, transaction=tx)
    record(goal.owner, "goal.contribution", goal, {"amount": str(tx.amount), "transaction": tx.pk})
    return contribution
