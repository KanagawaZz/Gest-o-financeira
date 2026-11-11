from datetime import date, timedelta

from django.db import transaction as db_transaction
from django.utils import timezone

from apps.transactions.models import Transaction as T
from common.utilities.dates import add_months

from .models import RecurringRule


def nth_date(rule: RecurringRule, k: int) -> date:
    d0 = rule.start_date
    if rule.frequency == RecurringRule.Frequency.WEEKLY:
        return d0 + timedelta(days=7 * k)
    if rule.frequency == RecurringRule.Frequency.MONTHLY:
        return add_months(d0, k)
    if rule.frequency == RecurringRule.Frequency.YEARLY:
        return add_months(d0, 12 * k)
    return d0 + timedelta(days=(rule.interval_days or 1) * k)  # custom


def occurrence_dates(rule: RecurringRule, since: date, until: date):
    """Datas da regra em [since, until], respeitando end_date. O dia-âncora vem de start_date."""
    k = 0
    while True:
        d = nth_date(rule, k)
        if d > until or (rule.end_date and d > rule.end_date):
            return
        if d >= since:
            yield d
        k += 1


def ensure_generated(owner, until: date) -> None:
    """Gera, sem duplicar, as ocorrências pendentes até `until`.

    Idempotente: a restrição única (regra, data) + ignore_conflicts garante que rodar de novo
    (ou em paralelo) não cria nada a mais. Ocorrências canceladas continuam existindo e por isso
    não são recriadas. Meses anteriores ao atual não são gerados (histórico é lançamento manual).
    """
    first_of_month = timezone.localdate().replace(day=1)
    rules = list(
        RecurringRule.objects.filter(owner=owner, is_active=True, start_date__lte=until).select_related("category", "account")
    )
    if not rules:
        return
    # Uma consulta para as datas já existentes de todas as regras (antes era uma por regra).
    # Filtrar a partir do mês atual cobre o `since` de toda regra (since >= first_of_month).
    existing: dict[int, set[date]] = {rule.pk: set() for rule in rules}
    rows = T.objects.filter(recurring_rule__in=rules, date__gte=first_of_month).values_list("recurring_rule_id", "date")
    for rule_id, d in rows:
        existing[rule_id].add(d)
    fresh = [
        T(
            owner=owner, type=rule.type, description=rule.description, amount=rule.amount,
            category=rule.category, account=rule.account, date=d, status=T.Status.PENDING,
            is_estimate=rule.variable, recurring_rule=rule,
        )
        for rule in rules
        for d in occurrence_dates(rule, max(rule.start_date, first_of_month), until)
        if d not in existing[rule.pk]
    ]  # fmt: skip
    if fresh:
        T.objects.bulk_create(fresh, ignore_conflicts=True)


def _future_pending(rule: RecurringRule):
    return T.objects.filter(recurring_rule=rule, status=T.Status.PENDING, date__gte=timezone.localdate())


@db_transaction.atomic
def apply_to_future(rule: RecurringRule) -> int:
    """Propaga os dados atuais da regra apenas para ocorrências futuras ainda pendentes."""
    return _future_pending(rule).update(
        description=rule.description, amount=rule.amount, category=rule.category,
        account=rule.account, is_estimate=rule.variable,
    )  # fmt: skip


@db_transaction.atomic
def cancel_future(rule: RecurringRule, after: date | None = None) -> int:
    qs = _future_pending(rule)
    if after:
        qs = qs.filter(date__gt=after)
    return qs.update(status=T.Status.CANCELLED, settled_date=None)
