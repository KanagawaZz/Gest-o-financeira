from datetime import date

import pytest

from apps.audit.models import AuditLog
from apps.recurring.models import RecurringRule
from apps.recurring.services import ensure_generated, nth_date
from apps.transactions.models import Transaction as T
from common.utilities.dates import add_months

from .helpers import balance, cat, in_days, iso, make_account, today

RULES = "/api/v1/recurring/"


def new_rule(client, user, account, **kw):
    body = dict(description="Internet", type="expense", amount="100.00", category=cat(user).pk, account=account.pk,
                frequency="monthly", start_date=iso(today()))  # fmt: skip
    body.update(kw)
    return client.post(RULES, body, format="json")


def test_month_end_anchor_does_not_drift():
    r = RecurringRule(frequency="monthly", start_date=date(2026, 1, 31))
    assert [nth_date(r, k) for k in range(4)] == [date(2026, 1, 31), date(2026, 2, 28), date(2026, 3, 31), date(2026, 4, 30)]
    assert nth_date(RecurringRule(frequency="yearly", start_date=date(2028, 2, 29)), 1) == date(2029, 2, 28)
    assert nth_date(RecurringRule(frequency="weekly", start_date=date(2026, 1, 1)), 2) == date(2026, 1, 15)
    assert nth_date(RecurringRule(frequency="custom", interval_days=10, start_date=date(2026, 1, 1)), 3) == date(2026, 1, 31)


def test_create_generates_24_months_of_pending_occurrences(auth_client, user):
    acc = make_account(user)
    r = new_rule(auth_client, user, acc)
    assert r.status_code == 201
    occ = T.objects.filter(recurring_rule_id=r.json()["id"])
    assert occ.count() == 25  # mês de início + 24
    assert set(occ.values_list("status", flat=True)) == {"pending"}
    assert occ.filter(date=add_months(today(), 12)).exists()
    assert balance(auth_client, acc) == 1000  # pendente não mexe no saldo


def test_generation_is_idempotent(auth_client, user):
    acc = make_account(user)
    rid = new_rule(auth_client, user, acc).json()["id"]
    before = T.objects.filter(recurring_rule_id=rid).count()
    for _ in range(3):
        ensure_generated(user, add_months(today(), 24))
    assert T.objects.filter(recurring_rule_id=rid).count() == before


def test_cancelled_occurrence_is_not_recreated(auth_client, user):
    acc = make_account(user)
    rid = new_rule(auth_client, user, acc).json()["id"]
    occ = T.objects.filter(recurring_rule_id=rid).order_by("date")[2]
    assert auth_client.delete(f"/api/v1/transactions/{occ.pk}/").status_code == 204
    occ.refresh_from_db()
    assert occ.status == "cancelled"
    total = T.objects.filter(recurring_rule_id=rid).count()
    ensure_generated(user, add_months(today(), 24))
    assert T.objects.filter(recurring_rule_id=rid).count() == total
    # canceladas não aparecem na listagem padrão
    ids = {t["id"] for t in auth_client.get("/api/v1/transactions/", {"page_size": 200}).json()["results"]}
    assert occ.pk not in ids


def test_paying_an_occurrence_hits_the_balance(auth_client, user):
    acc = make_account(user)
    rid = new_rule(auth_client, user, acc).json()["id"]
    first = T.objects.filter(recurring_rule_id=rid).order_by("date").first()
    r = auth_client.patch(f"/api/v1/transactions/{first.pk}/", {"status": "realized", "settled_date": iso(today())}, format="json")
    assert r.status_code == 200
    assert balance(auth_client, acc) == 900


def test_variable_rule_marks_estimates(auth_client, user):
    acc = make_account(user)
    rid = new_rule(auth_client, user, acc, description="Luz", variable=True).json()["id"]
    assert not T.objects.filter(recurring_rule_id=rid, is_estimate=False).exists()


def test_edit_applies_only_to_future_pending_when_confirmed(auth_client, user):
    acc = make_account(user)
    rid = new_rule(auth_client, user, acc).json()["id"]
    paid = T.objects.filter(recurring_rule_id=rid).order_by("date").first()
    auth_client.patch(f"/api/v1/transactions/{paid.pk}/", {"status": "realized"}, format="json")

    # Sem confirmação: ocorrências existentes ficam como estão.
    auth_client.patch(f"{RULES}{rid}/", {"amount": "120.00"}, format="json")
    assert set(T.objects.filter(recurring_rule_id=rid).values_list("amount", flat=True)) == {100}

    # Com confirmação: só as futuras pendentes mudam; o pago preserva o valor.
    auth_client.patch(f"{RULES}{rid}/", {"amount": "130.00", "apply_to_future": True}, format="json")
    paid.refresh_from_db()
    assert paid.amount == 100 and paid.status == "realized"
    future = T.objects.filter(recurring_rule_id=rid, status="pending", date__gte=today())
    assert future.exists() and set(future.values_list("amount", flat=True)) == {130}
    assert AuditLog.objects.filter(owner=user, action="rule.updated").exists()


def test_ending_rule_cancels_future_keeps_history(auth_client, user):
    acc = make_account(user)
    rid = new_rule(auth_client, user, acc).json()["id"]
    paid = T.objects.filter(recurring_rule_id=rid).order_by("date").first()
    auth_client.patch(f"/api/v1/transactions/{paid.pk}/", {"status": "realized"}, format="json")
    assert auth_client.delete(f"{RULES}{rid}/").status_code == 204
    assert RecurringRule.objects.get(pk=rid).is_active is False
    paid.refresh_from_db()
    assert paid.status == "realized"
    assert not T.objects.filter(recurring_rule_id=rid, status="pending").exists()
    ensure_generated(user, add_months(today(), 24))  # regra inativa não gera mais
    assert not T.objects.filter(recurring_rule_id=rid, status="pending").exists()


def test_end_date_cancels_pending_after_it(auth_client, user):
    acc = make_account(user)
    rid = new_rule(auth_client, user, acc).json()["id"]
    end = add_months(today(), 3)
    auth_client.patch(f"{RULES}{rid}/", {"end_date": iso(end)}, format="json")
    assert not T.objects.filter(recurring_rule_id=rid, status="pending", date__gt=end).exists()
    assert T.objects.filter(recurring_rule_id=rid, status="pending", date__lte=end).exists()


def test_rule_validation(auth_client, user):
    acc = make_account(user)
    assert new_rule(auth_client, user, acc, frequency="custom").status_code == 400  # falta intervalo
    assert new_rule(auth_client, user, acc, frequency="monthly", interval_days=5).status_code == 400
    assert new_rule(auth_client, user, acc, end_date=iso(in_days(-5))).status_code == 400
    assert new_rule(auth_client, user, acc, amount="0").status_code == 400
    assert new_rule(auth_client, user, acc, type="income").status_code == 400  # categoria de despesa em regra de receita
    rid = new_rule(auth_client, user, acc).json()["id"]
    assert auth_client.patch(f"{RULES}{rid}/", {"frequency": "weekly"}, format="json").status_code == 400


def test_rules_are_isolated(auth_client, other_user):
    acc = make_account(other_user, "Alheia")
    rule = RecurringRule.objects.create(owner=other_user, description="X", type="expense", amount=10, category=cat(other_user),
                                        account=acc, frequency="monthly", start_date=today())  # fmt: skip
    assert auth_client.get(f"{RULES}{rule.pk}/").status_code == 404
    assert auth_client.get(RULES).json()["count"] == 0


@pytest.mark.parametrize("field,value", [("amount", "5.00"), ("description", "outro")])
def test_single_occurrence_of_variable_bill_can_be_edited(auth_client, user, field, value):
    acc = make_account(user)
    rid = new_rule(auth_client, user, acc).json()["id"]
    occ = T.objects.filter(recurring_rule_id=rid).order_by("date").first()
    assert auth_client.patch(f"/api/v1/transactions/{occ.pk}/", {field: value}, format="json").status_code == 200
