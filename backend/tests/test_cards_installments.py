from datetime import date
from decimal import Decimal

import pytest
from django.db import IntegrityError, transaction

from apps.audit.models import AuditLog
from apps.credit_cards.models import CreditCard
from apps.credit_cards.services import cycle_for
from apps.installments.models import InstallmentPlan
from apps.transactions.models import Transaction as T

from .helpers import balance, cat, in_days, iso, make_account, today

CARDS = "/api/v1/credit-cards/"
PLANS = "/api/v1/installments/plans/"


def make_card(client, **kw):
    body = dict(name="Visa", institution="Banco", credit_limit="5000.00", closing_day=10, due_day=20)
    body.update(kw)
    return client.post(CARDS, body, format="json")


def buy(client, card_id, user, amount="300.00", d=None, installments=1, **kw):
    body = dict(description="Compra", amount=amount, category=cat(user).pk, date=iso(d or today()), installments=installments)
    body.update(kw)
    return client.post(f"{CARDS}{card_id}/purchases/", body, format="json")


# ---------- ciclo da fatura ----------
@pytest.mark.parametrize("closing,due,purchase,expected", [
    (10, 20, date(2026, 11, 5), (2026, 11, date(2026, 11, 10), date(2026, 11, 20))),   # antes do fechamento
    (10, 20, date(2026, 11, 10), (2026, 11, date(2026, 11, 10), date(2026, 11, 20))),  # no dia do fechamento
    (10, 20, date(2026, 11, 11), (2026, 12, date(2026, 12, 10), date(2026, 12, 20))),  # depois: próxima fatura
    (25, 5, date(2026, 11, 3), (2026, 11, date(2026, 11, 25), date(2026, 12, 5))),     # vence no mês seguinte
    (10, 20, date(2026, 12, 15), (2027, 1, date(2027, 1, 10), date(2027, 1, 20))),     # virada de ano
    (31, 10, date(2027, 2, 20), (2027, 2, date(2027, 2, 28), date(2027, 3, 10))),      # dia 31 em fevereiro
])  # fmt: skip
def test_invoice_cycle(closing, due, purchase, expected):
    card = CreditCard(closing_day=closing, due_day=due)
    y, m, c, d = cycle_for(card, purchase)
    assert (y, m, c, d) == (expected[0], expected[1], expected[2], expected[3])


# ---------- compras e limite ----------
def test_purchase_does_not_touch_balance_but_uses_limit(auth_client, user):
    acc = make_account(user)
    cid = make_card(auth_client).json()["id"]
    r = buy(auth_client, cid, user, "300.00")
    assert r.status_code == 201
    assert balance(auth_client, acc) == 1000
    card = auth_client.get(f"{CARDS}{cid}/").json()
    assert card["limit_used"] == "300.00" and card["limit_available"] == "4700.00"
    assert card["current_invoice"]["total"] in ("300.00", "0.00")  # depende de o ciclo atual conter hoje


def test_installment_purchase_on_card_spreads_over_invoices(auth_client, user):
    cid = make_card(auth_client).json()["id"]
    r = buy(auth_client, cid, user, "100.00", installments=3)
    assert r.status_code == 201
    rows = r.json()
    assert [x["installment_number"] for x in rows] == [1, 2, 3]
    assert sum(Decimal(x["amount"]) for x in rows) == Decimal("100.00")  # 33,33 + 33,33 + 33,34
    assert Decimal(rows[-1]["amount"]) == Decimal("33.34")
    assert len({x["invoice"] for x in rows}) == 3  # uma fatura por mês
    assert auth_client.get(f"{CARDS}{cid}/").json()["limit_used"] == "100.00"


def test_card_purchase_rules(auth_client, user, other_user):
    cid = make_card(auth_client).json()["id"]
    assert buy(auth_client, cid, user, "0").status_code == 400
    assert make_card(auth_client, closing_day=32).status_code == 400
    assert make_card(auth_client, name="visa").status_code == 400  # apelido duplicado
    # categoria de outro usuário / de receita são rejeitadas
    assert buy(auth_client, cid, user, category=cat(other_user).pk).status_code == 400
    assert buy(auth_client, cid, user, category=cat(user, "income").pk).status_code == 400


# ---------- pagamento da fatura ----------
def test_paying_invoice_is_cash_out_once_and_not_double_counted(auth_client, user):
    acc = make_account(user)
    cid = make_card(auth_client).json()["id"]
    buy(auth_client, cid, user, "300.00")
    buy(auth_client, cid, user, "200.00")
    inv = auth_client.get("/api/v1/credit-cards/invoices/").json()["results"][0]
    assert inv["total"] == "500.00" and inv["status"] == "open"

    pay = auth_client.post(f"/api/v1/credit-cards/invoices/{inv['id']}/pay/", {"account": acc.pk}, format="json")
    assert pay.status_code == 200 and pay.json()["status"] == "paid"
    assert balance(auth_client, acc) == 500  # saiu 500 uma única vez

    month = {"date_from": iso(today().replace(day=1)), "date_to": iso(in_days(40))}
    s = auth_client.get("/api/v1/transactions/summary/", month).json()
    assert s["expense_realized"] == "500.00"  # consumo: as compras; a fatura NÃO conta de novo
    assert s["expense_pending"] == "0.00"
    assert T.objects.filter(type="card_payment").count() == 1


def test_cannot_pay_twice_and_void_reopens_invoice(auth_client, user):
    acc = make_account(user)
    cid = make_card(auth_client).json()["id"]
    buy(auth_client, cid, user, "300.00")
    inv_id = auth_client.get("/api/v1/credit-cards/invoices/").json()["results"][0]["id"]
    url = f"/api/v1/credit-cards/invoices/{inv_id}/pay/"
    assert auth_client.post(url, {"account": acc.pk}, format="json").status_code == 200
    assert auth_client.post(url, {"account": acc.pk}, format="json").status_code == 409

    pay_tx = T.objects.get(type="card_payment")
    assert auth_client.post(f"/api/v1/transactions/{pay_tx.pk}/void/").status_code == 200
    assert balance(auth_client, acc) == 1000
    assert auth_client.get(f"/api/v1/credit-cards/invoices/{inv_id}/").json()["status"] == "open"
    assert set(T.objects.filter(credit_card_id=cid).values_list("status", flat=True)) == {"pending"}
    assert auth_client.post(url, {"account": acc.pk}, format="json").status_code == 200  # pode pagar de novo
    assert balance(auth_client, acc) == 700
    assert AuditLog.objects.filter(owner=user, action__in=["invoice.paid", "invoice.reopened"]).count() == 3


def test_empty_invoice_and_paid_invoice_rules(auth_client, user):
    acc = make_account(user)
    cid = make_card(auth_client).json()["id"]
    buy(auth_client, cid, user, "50.00")
    inv_id = auth_client.get("/api/v1/credit-cards/invoices/").json()["results"][0]["id"]
    auth_client.post(f"/api/v1/credit-cards/invoices/{inv_id}/pay/", {"account": acc.pk}, format="json")
    # nova compra na fatura já paga é recusada
    assert buy(auth_client, cid, user, "10.00").status_code == 400


def test_card_rows_are_protected_from_breaking_edits(auth_client, user):
    cid = make_card(auth_client).json()["id"]
    tx_id = buy(auth_client, cid, user, "80.00").json()[0]["id"]
    url = f"/api/v1/transactions/{tx_id}/"
    assert auth_client.patch(url, {"amount": "1.00"}, format="json").status_code == 400
    assert auth_client.patch(url, {"description": "Renomeada"}, format="json").status_code == 200
    assert auth_client.post(url + "void/").status_code == 409
    assert auth_client.delete(url).status_code == 204  # cancela
    assert T.objects.get(pk=tx_id).status == "cancelled"
    assert auth_client.get(f"{CARDS}{cid}/").json()["limit_used"] == "0.00"


def test_one_payment_per_invoice_is_enforced_by_the_database(user):
    from apps.credit_cards.models import CreditCardInvoice

    acc = make_account(user)
    card = CreditCard.objects.create(owner=user, name="X", credit_limit=100, closing_day=1, due_day=10)
    inv = CreditCardInvoice.objects.create(owner=user, card=card, year=2026, month=1, closing_date=date(2026, 1, 1), due_date=date(2026, 1, 10))
    mk = lambda: T.objects.create(owner=user, type="card_payment", description="p", amount=1, account=acc, invoice=inv, date=today())  # noqa: E731
    mk()
    with pytest.raises(IntegrityError), transaction.atomic():
        mk()


# ---------- parcelamentos em conta ----------
def make_plan(client, user, acc, **kw):
    body = dict(description="Celular", total_amount="4320.00", count=12, first_date=iso(today()), category=cat(user, name="Compras").pk, account=acc.pk)
    body.update(kw)
    return client.post(PLANS, body, format="json")


def test_plan_generates_exact_installments(auth_client, user):
    acc = make_account(user)
    r = make_plan(auth_client, user, acc, total_amount="100.00", count=3)
    assert r.status_code == 201
    rows = r.json()["installments"]
    assert [Decimal(x["amount"]) for x in rows] == [Decimal("33.33"), Decimal("33.33"), Decimal("33.34")]
    assert {x["status"] for x in rows} == {"pending"}
    assert r.json()["remaining_amount"] == "100.00" and r.json()["status"] == "active"
    assert balance(auth_client, acc) == 1000  # parcelas pendentes não alteram o saldo


def test_plan_installments_cannot_be_duplicated(auth_client, user):
    acc = make_account(user)
    pid = make_plan(auth_client, user, acc, count=3).json()["id"]
    plan = InstallmentPlan.objects.get(pk=pid)
    with pytest.raises(IntegrityError), transaction.atomic():
        T.objects.create(owner=user, type="expense", description="dup", amount=1, account=acc, date=today(),
                         installment_plan=plan, installment_number=2, status="pending")  # fmt: skip


def test_plan_progress_summary_and_installment_lock(auth_client, user):
    acc = make_account(user)
    pid = make_plan(auth_client, user, acc, total_amount="1200.00", count=12).json()["id"]
    first = T.objects.filter(installment_plan_id=pid).order_by("installment_number").first()
    assert auth_client.patch(f"/api/v1/transactions/{first.pk}/", {"amount": "1.00"}, format="json").status_code == 400
    assert auth_client.patch(f"/api/v1/transactions/{first.pk}/", {"status": "realized"}, format="json").status_code == 200
    assert balance(auth_client, acc) == 900

    plan = auth_client.get(f"{PLANS}{pid}/").json()
    assert plan["paid_count"] == 1 and plan["progress_percent"] == 8 and plan["remaining_amount"] == "1100.00"
    s = auth_client.get(PLANS + "summary/").json()
    assert s["committed_total"] == "1100.00" and s["active_plans"] == 1 and len(s["next_months"]) == 6


def test_early_payoff_settles_all_and_logs_event(auth_client, user):
    acc = make_account(user)
    pid = make_plan(auth_client, user, acc, total_amount="600.00", count=6).json()["id"]
    r = auth_client.post(f"{PLANS}{pid}/payoff/", {}, format="json")
    assert r.status_code == 200 and r.json()["status"] == "finished" and r.json()["early_payoff_at"]
    assert balance(auth_client, acc) == 400
    assert AuditLog.objects.filter(owner=user, action="plan.early_payoff", object_id=pid).exists()
    assert auth_client.get(PLANS, {"status": "finished"}).json()["count"] == 1
    assert auth_client.get(PLANS, {"status": "active"}).json()["count"] == 0


def test_cancel_plan_keeps_paid_cancels_pending(auth_client, user):
    acc = make_account(user)
    pid = make_plan(auth_client, user, acc, total_amount="300.00", count=3).json()["id"]
    first = T.objects.filter(installment_plan_id=pid).order_by("installment_number").first()
    auth_client.patch(f"/api/v1/transactions/{first.pk}/", {"status": "realized"}, format="json")
    assert auth_client.post(f"{PLANS}{pid}/cancel/").status_code == 200
    st = dict(T.objects.filter(installment_plan_id=pid).values_list("installment_number", "status"))
    assert st == {1: "realized", 2: "cancelled", 3: "cancelled"}
    assert auth_client.get(f"{PLANS}{pid}/").json()["status"] == "cancelled"


def test_plan_validation_and_isolation(auth_client, user, other_user):
    acc = make_account(user)
    assert make_plan(auth_client, user, acc, count=1).status_code == 400
    assert make_plan(auth_client, user, acc, total_amount="0").status_code == 400
    cid = make_card(auth_client).json()["id"]
    assert make_plan(auth_client, user, acc, credit_card=cid).status_code == 400  # conta E cartão
    assert make_plan(auth_client, user, acc, account=None).status_code == 400  # nenhum dos dois
    assert make_plan(auth_client, user, acc, account=make_account(other_user, "Alheia").pk).status_code == 400
    pid = make_plan(auth_client, user, acc).json()["id"]
    assert auth_client.patch(f"{PLANS}{pid}/", {"count": 3}, format="json").status_code == 400
    assert auth_client.delete(f"{PLANS}{pid}/").status_code == 405  # cancela-se, não apaga
