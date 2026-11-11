from collections import defaultdict
from datetime import date
from decimal import Decimal

from django.db.models import Q, Sum
from django.db.models.functions import Coalesce

from common.utilities.money import to_money

from .models import FinancialAccount


def balances_for_owner(owner, until: date | None = None) -> dict[int, Decimal]:
    """Saldo atual de cada conta do usuário (ou o saldo ao fim do dia `until`). Ver `_account_balances`."""
    return {acc.pk: balance for acc, balance in _account_balances(owner, until)}


def _account_balances(owner, until: date | None = None) -> list[tuple[FinancialAccount, Decimal]]:
    """(conta, saldo) de todas as contas do usuário, atual ou ao fim do dia `until`.

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

    for row in realized.order_by().values("account_id", "type").annotate(total=Sum("amount")):
        sign = 1 if row["type"] == T.Type.INCOME else -1  # despesa, fatura e transferência enviada saem
        delta[row["account_id"]] += sign * row["total"]

    incoming = realized.filter(type=T.Type.TRANSFER).order_by().values("destination_account_id").annotate(total=Sum("amount"))
    for row in incoming:
        delta[row["destination_account_id"]] += row["total"]

    return [(acc, to_money(acc.initial_balance + delta[acc.pk])) for acc in FinancialAccount.objects.filter(owner=owner)]


def total_available(owner, until: date | None = None) -> Decimal:
    """Saldo disponível = soma dos saldos das contas ativas (hoje, ou ao fim do dia `until`)."""
    # As contas já vêm junto com os saldos: não é preciso consultar as ativas à parte.
    return to_money(sum((b for acc, b in _account_balances(owner, until) if not acc.is_archived), Decimal("0")))


def total_available_at(owner, dates: list[date]) -> list[Decimal]:
    """`total_available(owner, d)` para cada data de `dates`, na mesma ordem.

    Mesma regra de `_account_balances` com `until`, mas com 3 consultas no total em vez de 3 por data:
    cada data vira uma soma condicional (realizado com data efetiva <= data) na mesma consulta agrupada.
    """
    from apps.transactions.models import Transaction as T

    if not dates:
        return []
    realized = (
        T.objects.filter(owner=owner, status=T.Status.REALIZED, account__isnull=False)
        .alias(effective=Coalesce("settled_date", "date"))
        .filter(effective__lte=max(dates))
    )
    sums = {f"t{k}": Sum("amount", filter=Q(effective__lte=d)) for k, d in enumerate(dates)}
    deltas: list[dict[int, Decimal]] = [defaultdict(Decimal) for _ in dates]

    for row in realized.order_by().values("account_id", "type").annotate(**sums):
        sign = 1 if row["type"] == T.Type.INCOME else -1  # despesa, fatura e transferência enviada saem
        for k, delta in enumerate(deltas):
            delta[row["account_id"]] += sign * (row[f"t{k}"] or Decimal("0"))

    for row in realized.filter(type=T.Type.TRANSFER).order_by().values("destination_account_id").annotate(**sums):
        for k, delta in enumerate(deltas):
            delta[row["destination_account_id"]] += row[f"t{k}"] or Decimal("0")

    active = list(FinancialAccount.objects.filter(owner=owner, is_archived=False))
    return [
        to_money(sum((to_money(acc.initial_balance + delta[acc.pk]) for acc in active), Decimal("0")))
        for delta in deltas
    ]
