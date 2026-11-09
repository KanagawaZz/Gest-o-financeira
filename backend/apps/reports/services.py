from datetime import date
from decimal import Decimal

from django.db.models import Count, Q, Sum

from apps.dashboard import services as dash
from apps.installments.models import InstallmentPlan
from apps.transactions.models import Transaction as T
from common.utilities.dates import add_months, month_bounds
from common.utilities.money import ZERO, to_money

MAX_SPAN_MONTHS = 60


def _s(v) -> str:
    return str(to_money(v or ZERO))


def consumption(owner, d_from: date, d_to: date):
    return T.objects.filter(owner=owner, type__in=dash.CONSUMPTION_TYPES, status__in=dash.LIVE, date__range=(d_from, d_to))


def _months(d_from: date, d_to: date) -> list[date]:
    out, cur = [], d_from.replace(day=1)
    while cur <= d_to:
        out.append(cur)
        cur = add_months(cur, 1)
    return out


def _breakdown(qs, kind: str, total: Decimal) -> list[dict]:
    rows = qs.filter(type=kind).values("category__name", "category__color").annotate(t=Sum("amount")).order_by("-t")
    return [
        {"name": r["category__name"] or "Sem categoria", "color": r["category__color"] or "#9BAABD",
         "amount": _s(r["t"]), "percent": round(100 * float(r["t"] / total), 1) if total else 0}
        for r in rows
    ]  # fmt: skip


def build_report(owner, d_from: date, d_to: date) -> dict:
    qs = consumption(owner, d_from, d_to)
    agg = {r["type"]: r["t"] for r in qs.values("type").annotate(t=Sum("amount"))}
    income, expense = agg.get(T.Type.INCOME, Decimal("0")), agg.get(T.Type.EXPENSE, Decimal("0"))

    monthly, prev_expense = [], None
    for m in _months(d_from, d_to):
        f, l = month_bounds(m.year, m.month)
        rows = {r["type"]: r["t"] for r in consumption(owner, f, l).values("type").annotate(t=Sum("amount"))}
        inc, exp = rows.get(T.Type.INCOME, Decimal("0")), rows.get(T.Type.EXPENSE, Decimal("0"))
        variation = round(100 * float((exp - prev_expense) / prev_expense), 1) if prev_expense else None
        monthly.append({"month": m.strftime("%Y-%m"), "income": _s(inc), "expense": _s(exp), "result": _s(inc - exp), "expense_variation_percent": variation})
        prev_expense = exp

    by_card = (
        qs.filter(type=T.Type.EXPENSE, credit_card__isnull=False).values("credit_card__name").annotate(t=Sum("amount"), n=Count("id")).order_by("-t")
    )  # fmt: skip
    plans = (
        InstallmentPlan.objects.filter(owner=owner, cancelled_at__isnull=True)
        .annotate(pend=Count("installments", filter=Q(installments__status=T.Status.PENDING)),
                  remaining=Sum("installments__amount", filter=Q(installments__status=T.Status.PENDING)))
        .filter(pend__gt=0).order_by("-remaining")
    )  # fmt: skip
    future = [
        {"month": p["month"], "expense": _s(Decimal(p["expense_confirmed"]) + Decimal(p["expense_estimated"])),
         "income": _s(Decimal(p["income_confirmed"]) + Decimal(p["income_estimated"])), "closing_balance": p["closing_balance"]}
        for p in dash.projection(owner, 6)
    ]  # fmt: skip

    return {
        "period": {"from": d_from.isoformat(), "to": d_to.isoformat()},
        "totals": {"income": _s(income), "expense": _s(expense), "result": _s(income - expense),
                   "committed_percent": round(100 * float(expense / income), 1) if income > 0 else None},  # fmt: skip
        "expense_by_category": _breakdown(qs, T.Type.EXPENSE, expense),
        "income_by_category": _breakdown(qs, T.Type.INCOME, income),
        "by_card": [{"card": r["credit_card__name"], "amount": _s(r["t"]), "purchases": r["n"]} for r in by_card],
        "monthly": monthly,
        "future_commitments": future,
        "active_installments": [{"id": p.pk, "description": p.description, "remaining_amount": _s(p.remaining), "remaining_count": p.pend, "count": p.count} for p in plans],
        "largest_expenses": [
            {"description": t.description, "amount": _s(t.amount), "date": t.date.isoformat()}
            for t in qs.filter(type=T.Type.EXPENSE).order_by("-amount")[:5]
        ],  # fmt: skip
    }
