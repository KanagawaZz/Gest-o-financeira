"""Cálculos do dashboard, da projeção e do simulador. Tudo no backend (plano §7.2).

Duas visões, nunca misturadas:
- CONSUMO (competência): despesas/receitas por `date`, pendentes ou realizadas. Compra no cartão
  conta na data da compra; pagar a fatura NÃO conta de novo.
- CAIXA: saldos das contas e projeção. Compra no cartão só vira saída de caixa na fatura.
"""
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone

from apps.accounts.services import total_available
from apps.credit_cards import services as card_services
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
    for inv in CreditCardInvoice.objects.filter(owner=owner, status=CreditCardInvoice.Status.OPEN, due_date__lte=until).select_related("card"):
        total = card_services.invoice_total(inv)
        if total > 0:
            events.append(Event(inv.due_date, f"Fatura {inv.card.name} {inv.month:02d}/{inv.year}", T.Type.EXPENSE, total, "invoice", False, inv.pk))
    return sorted(events, key=lambda e: (e.date, e.description))


def projection(owner, months: int, extra: list[Event] | None = None, today: date | None = None) -> list[dict]:
    """Saldo projetado mês a mês: saldo inicial + entradas previstas − saídas previstas.

    O primeiro mês absorve o que está atrasado. `closing_balance` considera tudo o que está previsto;
    `closing_balance_conservative` ignora receitas *estimadas* (não garantidas) e mantém todas as saídas.
    """
    months = max(1, min(months, MAX_MONTHS))
    today = today or timezone.localdate()
    base = today.replace(day=1)
    horizon_end = month_bounds(*divmod_ym(add_months(base, months - 1)))[1]
    ensure_generated(owner, horizon_end)

    events = pending_cash_events(owner, horizon_end) + list(extra or [])
    buckets: list[list[Event]] = [[] for _ in range(months)]
    for e in events:
        idx = max(0, month_index(e.date, base))
        if idx < months:
            buckets[idx].append(e)

    opening = total_available(owner)
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
    base = projection(owner, months)
    with_purchase = projection(owner, months, extra)
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
def upcoming(owner, days: int = 30, limit: int = 8) -> list[dict]:
    today = timezone.localdate()
    ensure_generated(owner, today + timedelta(days=days))
    items = []
    for e in pending_cash_events(owner, today + timedelta(days=days)):
        if e.kind != T.Type.EXPENSE and e.source != "transaction":
            continue
        left = (e.date - today).days
        items.append({
            "id": e.ref_id, "source": e.source, "kind": e.kind, "description": e.description, "amount": _s(e.amount),
            "due_date": e.date.isoformat(), "days_left": left,
            "status": "overdue" if left < 0 else ("due_soon" if left <= 7 else "pending"),
        })  # fmt: skip
    return items[:limit]


def alerts(owner) -> list[dict]:
    today = timezone.localdate()
    out = []
    ups = upcoming(owner, days=30, limit=500)
    overdue = [u for u in ups if u["status"] == "overdue" and u["kind"] == "expense"]
    soon = [u for u in ups if u["status"] == "due_soon" and u["kind"] == "expense"]
    if overdue:
        out.append({"level": "danger", "code": "overdue", "message": f"{len(overdue)} conta(s) atrasada(s), somando R$ {_fmt(sum(Decimal(u['amount']) for u in overdue))}."})
    if soon:
        out.append({"level": "warning", "code": "due_soon", "message": f"{len(soon)} vencimento(s) nos próximos 7 dias, somando R$ {_fmt(sum(Decimal(u['amount']) for u in soon))}."})
    proj = projection(owner, 3, today=today)
    neg = next((p for p in proj if Decimal(p["closing_balance"]) < 0), None)
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
    ensure_generated(owner, last)
    qs = _consumption(owner, first, last)

    def total(**kw):
        return qs.filter(**kw).aggregate(t=Sum("amount"))["t"] or ZERO

    inc_rec, inc_exp = total(type=T.Type.INCOME, status=T.Status.REALIZED), total(type=T.Type.INCOME, status=T.Status.PENDING)
    exp_paid, exp_pend = total(type=T.Type.EXPENSE, status=T.Status.REALIZED), total(type=T.Type.EXPENSE, status=T.Status.PENDING)
    income_all, expense_all = inc_rec + inc_exp, exp_paid + exp_pend

    cur_idx = month_index(first, today)
    projected = None
    if 0 <= cur_idx < MAX_MONTHS:
        projected = projection(owner, cur_idx + 1)[cur_idx]["closing_balance"]

    by_cat = (
        qs.filter(type=T.Type.EXPENSE).values("category_id", "category__name", "category__color")
        .annotate(total=Sum("amount")).order_by("-total")
    )  # fmt: skip
    cats = [{"category_id": r["category_id"], "name": r["category__name"] or "Sem categoria", "color": r["category__color"] or "#9BAABD",
             "amount": _s(r["total"]), "percent": round(100 * r["total"] / expense_all, 1) if expense_all else 0} for r in by_cat]  # fmt: skip

    series = []
    for i in range(5, -1, -1):
        f, l = month_bounds(*divmod_ym(add_months(first, -i)))
        m = _consumption(owner, f, l).values("type").annotate(t=Sum("amount"))
        d = {r["type"]: r["t"] for r in m}
        series.append({"month": month_label(f), "income": _s(d.get(T.Type.INCOME)), "expense": _s(d.get(T.Type.EXPENSE))})

    return {
        "month": f"{year:04d}-{month:02d}",
        "indicators": {
            "income_received": _s(inc_rec), "income_expected": _s(inc_exp),
            "expense_paid": _s(exp_paid), "expense_pending": _s(exp_pend),
            "current_balance": _s(total_available(owner)), "projected_balance": projected,
            "month_result": _s(inc_rec - exp_paid),
            "committed_percent": round(100 * float(expense_all / income_all), 1) if income_all > 0 else None,
        },
        "explanations": EXPLANATIONS,
        "by_category": cats,
        "series": series,
        "upcoming": upcoming(owner),
        "recurring_and_installments": _commitments(owner, first, last),
        "alerts": alerts(owner),
    }


def _commitments(owner, first: date, last: date) -> dict:
    qs = T.objects.filter(owner=owner, type=T.Type.EXPENSE, status=T.Status.PENDING, date__range=(first, last))
    return {
        "recurring_total": _s(qs.filter(recurring_rule__isnull=False).aggregate(t=Sum("amount"))["t"]),
        "recurring_count": qs.filter(recurring_rule__isnull=False).count(),
        "installments_total": _s(qs.filter(installment_plan__isnull=False).aggregate(t=Sum("amount"))["t"]),
        "installments_count": qs.filter(installment_plan__isnull=False).count(),
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

