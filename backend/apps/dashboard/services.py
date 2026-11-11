"""Cálculos do dashboard, da projeção e do simulador. Tudo no backend (plano §7.2).

Duas visões, nunca misturadas:
- CONSUMO (competência): despesas/receitas por `date`, pendentes ou realizadas. Compra no cartão
  conta na data da compra; pagar a fatura NÃO conta de novo.
- CAIXA: saldos das contas e projeção. Compra no cartão só vira saída de caixa na fatura.
"""
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Count, DecimalField, Q, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone

from apps.accounts.services import total_available, total_available_at
from apps.credit_cards.models import CreditCardInvoice
from apps.recurring.services import ensure_generated
from apps.transactions.models import Transaction as T
from common.utilities.dates import add_months, month_bounds, month_index
from common.utilities.money import ZERO, split_installments, to_money

CONSUMPTION_TYPES = [T.Type.INCOME, T.Type.EXPENSE]
LIVE = [T.Status.PENDING, T.Status.REALIZED]
MAX_MONTHS = 24


@dataclass
class Event:
    date: date
    description: str
    kind: str  # income | expense
    amount: Decimal
    source: str  # transaction | invoice | simulation
    estimate: bool = False
    ref_id: int | None = None


def _s(value) -> str:
    return str(to_money(value or ZERO))


def month_label(d: date) -> str:
    return d.strftime("%Y-%m")


# ---------------------------------------------------------------- eventos futuros de caixa
def pending_cash_events(owner, until: date) -> list[Event]:
    """Entradas/saídas previstas que ainda vão mexer no saldo: lançamentos pendentes de conta
    (inclui atrasados e parcelas) e faturas de cartão não pagas, no vencimento."""
    events: list[Event] = []
    rows = T.objects.filter(
        owner=owner, status=T.Status.PENDING, account__isnull=False,
        type__in=CONSUMPTION_TYPES, date__lte=until,
    ).values("id", "date", "description", "type", "amount", "is_estimate")  # fmt: skip
    for r in rows:
        events.append(Event(r["date"], r["description"], r["type"], r["amount"], "transaction", r["is_estimate"], r["id"]))
    invoices = (
        CreditCardInvoice.objects.filter(owner=owner, status=CreditCardInvoice.Status.OPEN, due_date__lte=until)
        .select_related("card")
        .annotate(
            annotated_total=Coalesce(
                Sum(
                    "entries__amount",
                    filter=Q(entries__type=T.Type.EXPENSE) & ~Q(entries__status__in=[T.Status.CANCELLED, T.Status.VOIDED]),
                ),
                Decimal("0"),
                output_field=DecimalField(),
            )
        )
    )
    for inv in invoices:
        total = to_money(inv.annotated_total)  # pyrefly: ignore[missing-attribute]  (campo criado pelo .annotate acima)
        if total > 0:
            events.append(Event(inv.due_date, f"Fatura {inv.card.name} {inv.month:02d}/{inv.year}", T.Type.EXPENSE, total, "invoice", False, inv.pk))
    return sorted(events, key=lambda e: (e.date, e.description))


@dataclass
class ProjectionInput:
    """O que a projeção lê do banco. Montado uma vez e reaproveitado (simulador e resumo)."""

    months: int
    today: date
    events: list[Event]  # pendentes até o fim do horizonte, ordenados
    opening: Decimal  # saldo disponível atual


def _clamp_months(months: int) -> int:
    return max(1, min(months, MAX_MONTHS))


def horizon_end(today: date, months: int) -> date:
    """Último dia do último mês projetado."""
    return month_bounds(*divmod_ym(add_months(today.replace(day=1), _clamp_months(months) - 1)))[1]


def projection_input(owner, months: int, today: date | None = None, *, generate: bool = True) -> ProjectionInput:
    """Lê do banco o necessário para projetar. `generate=False` quando quem chama já gerou as recorrências."""
    months = _clamp_months(months)
    today = today or timezone.localdate()
    end = horizon_end(today, months)
    if generate:
        ensure_generated(owner, end)
    return ProjectionInput(months, today, pending_cash_events(owner, end), total_available(owner))


def projection(owner, months: int, extra: list[Event] | None = None, today: date | None = None) -> list[dict]:
    """Saldo projetado mês a mês: saldo inicial + entradas previstas − saídas previstas.

    O primeiro mês absorve o que está atrasado. `closing_balance` considera tudo o que está previsto;
    `closing_balance_conservative` ignora receitas *estimadas* (não garantidas) e mantém todas as saídas.
    """
    return project(projection_input(owner, months, today), extra)


def project(data: ProjectionInput, extra: list[Event] | None = None) -> list[dict]:
    """Cálculo da projeção (sem acesso ao banco)."""
    months, today = data.months, data.today
    base = today.replace(day=1)
    events = data.events + list(extra or [])
    buckets: list[list[Event]] = [[] for _ in range(months)]
    for e in events:
        idx = max(0, month_index(e.date, base))
        if idx < months:
            buckets[idx].append(e)

    opening = data.opening
    opening_c = opening
    out = []
    for i, evs in enumerate(buckets):
        def total(kind, estimate=None):
            return sum((e.amount for e in evs if e.kind == kind and (estimate is None or e.estimate == estimate)), Decimal("0"))

        inc_conf, inc_est = total(T.Type.INCOME, False), total(T.Type.INCOME, True)
        exp_conf, exp_est = total(T.Type.EXPENSE, False), total(T.Type.EXPENSE, True)
        closing = opening + inc_conf + inc_est - exp_conf - exp_est
        closing_c = opening_c + inc_conf - exp_conf - exp_est
        out.append({
            "month": month_label(add_months(base, i)),
            "opening_balance": _s(opening),
            "income_confirmed": _s(inc_conf), "income_estimated": _s(inc_est),
            "expense_confirmed": _s(exp_conf), "expense_estimated": _s(exp_est),
            "closing_balance": _s(closing), "closing_balance_conservative": _s(closing_c),
            "items": [
                {"date": e.date.isoformat(), "description": e.description, "kind": e.kind, "amount": _s(e.amount),
                 "source": e.source, "estimate": e.estimate, "overdue": e.date < today and e.source != "simulation"}
                for e in evs
            ],
        })  # fmt: skip
        opening, opening_c = closing, closing_c
    return out


def divmod_ym(d: date) -> tuple[int, int]:
    return d.year, d.month


# ---------------------------------------------------------------- simulador
def simulate(owner, *, amount, installments: int, first_date: date, months: int = 12) -> dict:
    """Compara o cenário atual com o cenário pós-compra. NÃO grava nada."""
    extra = [
        Event(add_months(first_date, k), "Compra simulada", T.Type.EXPENSE, part, "simulation")
        for k, part in enumerate(split_installments(amount, installments))
    ]
    data = projection_input(owner, months)  # lê o banco uma vez para os dois cenários
    base = project(data)
    with_purchase = project(data, extra)
    impact = []
    for b, w in zip(base, with_purchase, strict=True):
        added = Decimal(b["closing_balance"]) - Decimal(w["closing_balance"])
        sim_month = sum((e.amount for e in extra if month_label(e.date) == b["month"]), Decimal("0"))
        impact.append({"month": b["month"], "installment": _s(sim_month), "balance_before": b["closing_balance"],
                       "balance_after": w["closing_balance"], "accumulated_impact": _s(added), "affected": sim_month > 0})  # fmt: skip
    negative = [i["month"] for i in impact if Decimal(i["balance_after"]) < 0 <= Decimal(next(b for b in base if b["month"] == i["month"])["closing_balance"])]
    return {
        "monthly_installment": _s(extra[0].amount), "installments": installments,
        "months_affected": [i["month"] for i in impact if i["affected"]],
        "becomes_negative_in": negative, "baseline": base, "with_purchase": with_purchase, "impact": impact,
        "persisted": False,
    }  # fmt: skip


# ---------------------------------------------------------------- alertas e vencimentos
def upcoming(owner, days: int = 30, limit: int = 8, *, events: list[Event] | None = None) -> list[dict]:
    """Vencimentos até `days` dias. `events`: pendentes já lidos (de qualquer horizonte >= esse)."""
    today = timezone.localdate()
    until = today + timedelta(days=days)
    if events is None:
        ensure_generated(owner, until)
        events = pending_cash_events(owner, until)
    items = []
    for e in events:
        if e.date > until:
            continue
        if e.kind != T.Type.EXPENSE and e.source != "transaction":
            continue
        left = (e.date - today).days
        items.append({
            "id": e.ref_id, "source": e.source, "kind": e.kind, "description": e.description, "amount": _s(e.amount),
            "due_date": e.date.isoformat(), "days_left": left,
            "status": "overdue" if left < 0 else ("due_soon" if left <= 7 else "pending"),
        })  # fmt: skip
    return items[:limit]


def alerts(owner, proj: list[dict] | None = None, ups: list[dict] | None = None) -> list[dict]:
    """`ups`: vencimentos dos próximos 30 dias (limit=500) já calculados por quem chama."""
    today = timezone.localdate()
    out = []
    ups = upcoming(owner, days=30, limit=500) if ups is None else ups
    overdue = [u for u in ups if u["status"] == "overdue" and u["kind"] == "expense"]
    soon = [u for u in ups if u["status"] == "due_soon" and u["kind"] == "expense"]
    if overdue:
        out.append({"level": "danger", "code": "overdue", "message": f"{len(overdue)} conta(s) atrasada(s), somando R$ {_fmt(sum((Decimal(u['amount']) for u in overdue), ZERO))}."})
    if soon:
        out.append({"level": "warning", "code": "due_soon", "message": f"{len(soon)} vencimento(s) nos próximos 7 dias, somando R$ {_fmt(sum((Decimal(u['amount']) for u in soon), ZERO))}."})
    proj_3 = proj[:3] if proj is not None else projection(owner, 3, today=today)
    neg = next((p for p in proj_3 if Decimal(p["closing_balance"]) < 0), None)
    if neg:
        out.append({"level": "danger", "code": "negative_projection", "message": f"O saldo projetado fica negativo em {neg['month']} (R$ {_fmt(Decimal(neg['closing_balance']))})."})
    return out


def _fmt(v: Decimal) -> str:
    return f"{to_money(v):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


# ---------------------------------------------------------------- resumo mensal (consumo)
def _consumption(owner, first: date, last: date):
    return T.objects.filter(owner=owner, type__in=CONSUMPTION_TYPES, status__in=LIVE, date__range=(first, last))


def summary(owner, year: int, month: int) -> dict:
    today = timezone.localdate()
    first, last = month_bounds(year, month)
    cur_idx = month_index(first, today)
    proj_months = max(6, cur_idx + 1) if cur_idx < MAX_MONTHS else 6
    # Uma única geração de recorrências cobre tudo o que o resumo lê: o mês consultado, a projeção
    # e os vencimentos dos próximos 30 dias (o horizonte da projeção tem no mínimo 6 meses).
    ensure_generated(owner, max(last, horizon_end(today, proj_months)))
    proj_data = projection_input(owner, proj_months, today, generate=False)
    ups = upcoming(owner, days=30, limit=500, events=proj_data.events)
    qs = _consumption(owner, first, last)

    grouped = {(r["type"], r["status"]): r["t"] for r in qs.order_by().values("type", "status").annotate(t=Sum("amount"))}

    def total(tx_type, tx_status):
        return grouped.get((tx_type, tx_status)) or ZERO

    inc_rec, inc_exp = total(T.Type.INCOME, T.Status.REALIZED), total(T.Type.INCOME, T.Status.PENDING)
    exp_paid, exp_pend = total(T.Type.EXPENSE, T.Status.REALIZED), total(T.Type.EXPENSE, T.Status.PENDING)
    income_all, expense_all = inc_rec + inc_exp, exp_paid + exp_pend

    proj = project(proj_data)
    projected = proj[cur_idx]["closing_balance"] if 0 <= cur_idx < MAX_MONTHS else None

    by_cat = (
        qs.filter(type=T.Type.EXPENSE).order_by().values("category_id", "category__name", "category__color")
        .annotate(total=Sum("amount")).order_by("-total")
    )  # fmt: skip
    cats = [{"category_id": r["category_id"], "name": r["category__name"] or "Sem categoria", "color": r["category__color"] or "#9BAABD",
             "amount": _s(r["total"]), "percent": round(100 * r["total"] / expense_all, 1) if expense_all else 0} for r in by_cat]  # fmt: skip

    series = []
    trend_keys = {
        "income_received": (T.Type.INCOME, T.Status.REALIZED), "income_expected": (T.Type.INCOME, T.Status.PENDING),
        "expense_paid": (T.Type.EXPENSE, T.Status.REALIZED), "expense_pending": (T.Type.EXPENSE, T.Status.PENDING),
    }  # fmt: skip
    trends: dict[str, list[dict]] = {k: [] for k in trend_keys}
    for i in range(5, -1, -1):
        f, l = month_bounds(*divmod_ym(add_months(first, -i)))
        m = _consumption(owner, f, l).order_by().values("type", "status").annotate(t=Sum("amount"))
        d = {(r["type"], r["status"]): r["t"] for r in m}
        inc = (d.get((T.Type.INCOME, T.Status.REALIZED)) or ZERO) + (d.get((T.Type.INCOME, T.Status.PENDING)) or ZERO)
        exp = (d.get((T.Type.EXPENSE, T.Status.REALIZED)) or ZERO) + (d.get((T.Type.EXPENSE, T.Status.PENDING)) or ZERO)
        series.append({"month": month_label(f), "income": _s(inc), "expense": _s(exp)})
        for key, pair in trend_keys.items():
            trends[key].append({"month": month_label(f), "value": _s(d.get(pair))})

    # Saldos são de caixa e têm âncora em hoje: o atual olha para trás (fim de cada mês; o último é hoje)
    # e o projetado olha para frente (fechamento previsto do mês atual e dos 5 seguintes).
    this_month = today.replace(day=1)
    hist_months = [add_months(this_month, -i) for i in range(5, -1, -1)]
    hist_balances = total_available_at(owner, [min(today, month_bounds(*divmod_ym(m))[1]) for m in hist_months])
    trends["current_balance"] = [{"month": month_label(m), "value": _s(b)} for m, b in zip(hist_months, hist_balances, strict=True)]
    trends["projected_balance"] = [{"month": p["month"], "value": p["closing_balance"]} for p in proj[:6]]
    current_bal = trends["current_balance"][-1]["value"]

    return {
        "month": f"{year:04d}-{month:02d}",
        "indicators": {
            "income_received": _s(inc_rec), "income_expected": _s(inc_exp),
            "expense_paid": _s(exp_paid), "expense_pending": _s(exp_pend),
            "current_balance": current_bal, "projected_balance": projected,
            "month_result": _s(inc_rec - exp_paid),
            "committed_percent": round(100 * float(expense_all / income_all), 1) if income_all > 0 else None,
        },
        "explanations": EXPLANATIONS,
        "by_category": cats,
        "series": series,
        "trends": trends,
        "upcoming": ups[:8],
        "recurring_and_installments": _commitments(owner, first, last),
        "alerts": alerts(owner, proj=proj, ups=ups),
    }


def _commitments(owner, first: date, last: date) -> dict:
    qs = T.objects.filter(owner=owner, type=T.Type.EXPENSE, status=T.Status.PENDING, date__range=(first, last))
    agg = qs.aggregate(
        rec_total=Sum("amount", filter=Q(recurring_rule__isnull=False)),
        rec_count=Count("id", filter=Q(recurring_rule__isnull=False)),
        inst_total=Sum("amount", filter=Q(installment_plan__isnull=False)),
        inst_count=Count("id", filter=Q(installment_plan__isnull=False)),
    )
    return {
        "recurring_total": _s(agg["rec_total"]),
        "recurring_count": agg["rec_count"] or 0,
        "installments_total": _s(agg["inst_total"]),
        "installments_count": agg["inst_count"] or 0,
    }


EXPLANATIONS = {
    "income_received": "Receitas já recebidas com data neste mês.",
    "income_expected": "Receitas do mês ainda não recebidas (pendentes).",
    "expense_paid": "Despesas do mês já pagas. Compras no cartão contam quando a fatura é paga.",
    "expense_pending": "Despesas do mês ainda não pagas, incluindo compras no cartão em fatura aberta.",
    "current_balance": "Soma do saldo das contas ativas hoje, considerando só o que já foi realizado.",
    "projected_balance": "Saldo atual + entradas previstas − saídas previstas até o fim do mês (faturas entram no vencimento).",
    "month_result": "Receitas recebidas − despesas pagas no mês.",
    "committed_percent": "Despesas do mês (pagas + pendentes) como % das receitas do mês (recebidas + previstas).",
}

