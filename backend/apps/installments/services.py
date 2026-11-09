from datetime import date

from django.db import transaction as db_transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.audit.services import record
from apps.credit_cards import services as card_services
from apps.transactions.models import Transaction as T
from common.utilities.dates import add_months
from common.utilities.money import split_installments

from .models import InstallmentPlan


@db_transaction.atomic
def create_plan(owner, *, description, total_amount, count, first_date, category, account=None, card=None, notes="") -> InstallmentPlan:
    """Cria o plano e todas as parcelas de uma vez (atômico: ou tudo, ou nada).

    A soma das parcelas é sempre igual ao total; a diferença de centavos fica na última.
    O número da parcela é único por plano, então não há como duplicar parcelas.
    """
    if (account is None) == (card is None):
        raise ValidationError({"account": "Informe a conta OU o cartão da compra."})
    if count < 2:
        raise ValidationError({"count": "Use pelo menos 2 parcelas."})
    plan = InstallmentPlan.objects.create(
        owner=owner, description=description, total_amount=total_amount, count=count, first_date=first_date,
        category=category, account=account, credit_card=card, notes=notes,
    )  # fmt: skip
    for k, part in enumerate(split_installments(total_amount, count)):
        label = f"{description} ({k + 1}/{count})"
        due = add_months(first_date, k)
        if card is not None:
            card_services.add_purchase(card, description=label, amount=part, category=category, date=due, notes=notes, plan=plan, number=k + 1)
        else:
            T.objects.create(
                owner=owner, type=T.Type.EXPENSE, description=label, amount=part, category=category, account=account,
                date=due, status=T.Status.PENDING, notes=notes, installment_plan=plan, installment_number=k + 1,
            )  # fmt: skip
    record(owner, "plan.created", plan, {"total": str(total_amount), "count": count})
    return plan


@db_transaction.atomic
def payoff(plan: InstallmentPlan, paid_date: date | None = None) -> int:
    """Quitação antecipada: liquida todas as parcelas pendentes e registra o evento."""
    plan = InstallmentPlan.objects.select_for_update().get(pk=plan.pk)
    if plan.credit_card_id:
        raise ValidationError({"detail": "Parcelamentos no cartão são quitados pagando as faturas."})
    if plan.cancelled_at:
        raise ValidationError({"detail": "Parcelamento cancelado."})
    paid_date = paid_date or timezone.localdate()
    pending = plan.installments.filter(status=T.Status.PENDING)
    n = pending.update(status=T.Status.REALIZED, settled_date=paid_date)
    plan.early_payoff_at = paid_date
    plan.save(update_fields=["early_payoff_at"])
    record(plan.owner, "plan.early_payoff", plan, {"settled_installments": n, "date": paid_date.isoformat()})
    return n


@db_transaction.atomic
def cancel_plan(plan: InstallmentPlan) -> int:
    """Cancela só as parcelas pendentes; o que já foi pago permanece no histórico."""
    n = plan.installments.filter(status=T.Status.PENDING).update(status=T.Status.CANCELLED)
    plan.cancelled_at = timezone.now()
    plan.save(update_fields=["cancelled_at"])
    record(plan.owner, "plan.cancelled", plan, {"cancelled_installments": n})
    return n
