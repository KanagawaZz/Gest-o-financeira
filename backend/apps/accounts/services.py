from collections import defaultdict
from datetime import date
from decimal import Decimal

from django.db.models import Sum
from django.db.models.functions import Coalesce

from common.utilities.money import to_money

from .models import FinancialAccount


def balances_for_owner(owner, until: date | None = None) -> dict[int, Decimal]:
    """Saldo atual de cada conta do usuário (ou o saldo ao fim do dia `until`).

    saldo = saldo inicial + receitas realizadas - despesas realizadas - pagamentos de fatura
            - transferências enviadas + transferências recebidas.
    Pendentes, estornadas, canceladas e compras no cartão (sem conta) não entram.
    Com `until`, só conta o que foi realizado até essa data (data efetiva; sem ela, a do lançamento).
    Calculado sempre no backend, nunca gravado.
    """
    from apps.transactions.models import Transaction as T

    realized = T.objects.filter(owner=owner, status=T.Status.REALIZED, account__isnull=False)
    if until is not None:
        realized = realized.annotate(effective=Coalesce("settled_date", "date")).filter(effective__lte=until)
    delta: dict[int, Decimal] = defaultdict(Decimal)

    for row in realized.values("account_id", "type").annotate(total=Sum("amount")):
        sign = 1 if row["type"] == T.Type.INCOME else -1  # despesa, fatura e transferência enviada saem
        delta[row["account_id"]] += sign * row["total"]

    incoming = realized.filter(type=T.Type.TRANSFER).values("destination_account_id").annotate(total=Sum("amount"))
    for row in incoming:
        delta[row["destination_account_id"]] += row["total"]

    return {
        acc.pk: to_money(acc.initial_balance + delta[acc.pk])
        for acc in FinancialAccount.objects.filter(owner=owner)
    }


def current_balance(account: FinancialAccount) -> Decimal:
    return balances_for_owner(account.owner)[account.pk]


def total_available(owner, until: date | None = None) -> Decimal:
    """Saldo disponível = soma dos saldos das contas ativas (hoje, ou ao fim do dia `until`)."""
    active = set(FinancialAccount.objects.filter(owner=owner, is_archived=False).values_list("pk", flat=True))
    return to_money(sum((b for pk, b in balances_for_owner(owner, until).items() if pk in active), Decimal("0")))
