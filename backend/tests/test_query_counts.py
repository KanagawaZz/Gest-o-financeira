"""Proteção contra regressões de desempenho: o número de consultas SQL não pode crescer com a
quantidade de registros (N+1). Compara a mesma requisição com poucos e com mais registros."""
from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.recurring.services import ensure_generated
from apps.transactions.models import Transaction as T
from common.utilities.dates import add_months

from .helpers import cat, iso, make_account, today
from .test_cards_installments import buy, make_card, make_plan
from .test_recurring import new_rule


def queries(fn) -> int:
    with CaptureQueriesContext(connection) as ctx:
        fn()
    return len(ctx.captured_queries)


def get_ok(client, url):
    def run():
        r = client.get(url)
        assert r.status_code == 200, r.content

    return run


def test_plan_list_queries_do_not_grow_with_plans(auth_client, user):
    acc = make_account(user)
    make_plan(auth_client, user, acc)
    one = queries(get_ok(auth_client, "/api/v1/installments/plans/"))
    for name in ("Notebook", "Geladeira", "Sofá"):
        make_plan(auth_client, user, acc, description=name)
    assert queries(get_ok(auth_client, "/api/v1/installments/plans/")) == one


def test_plan_list_values_still_come_from_annotation(auth_client, user):
    acc = make_account(user)
    make_plan(auth_client, user, acc, total_amount="1200.00", count=3)
    plan = auth_client.get("/api/v1/installments/plans/").json()["results"][0]
    assert (plan["paid_count"], plan["pending_count"], plan["remaining_amount"]) == (0, 3, "1200.00")
    assert (plan["status"], plan["progress_percent"]) == ("active", 0)


def test_invoice_list_queries_do_not_grow_with_invoices(auth_client, user):
    card = make_card(auth_client).json()["id"]
    buy(auth_client, card, user)
    one = queries(get_ok(auth_client, "/api/v1/credit-cards/invoices/"))
    for k in range(1, 4):  # compras em meses diferentes = faturas diferentes
        buy(auth_client, card, user, d=add_months(today(), k))
    assert len(auth_client.get("/api/v1/credit-cards/invoices/").json()["results"]) == 4
    assert queries(get_ok(auth_client, "/api/v1/credit-cards/invoices/")) == one


def test_invoice_payment_transaction_follows_pay_and_void(auth_client, user):
    acc = make_account(user)
    card = make_card(auth_client).json()["id"]
    buy(auth_client, card, user)
    inv_id = auth_client.get("/api/v1/credit-cards/invoices/").json()["results"][0]["id"]
    assert auth_client.get(f"/api/v1/credit-cards/invoices/{inv_id}/").json()["payment_transaction"] is None

    paid = auth_client.post(f"/api/v1/credit-cards/invoices/{inv_id}/pay/", {"account": acc.pk}, format="json")
    assert paid.status_code == 200
    pay_tx = T.objects.get(invoice_id=inv_id, type=T.Type.CARD_PAYMENT)
    assert paid.json()["payment_transaction"] == pay_tx.pk  # resposta do próprio pagamento já atualizada
    assert auth_client.get("/api/v1/credit-cards/invoices/").json()["results"][0]["payment_transaction"] == pay_tx.pk
    assert auth_client.get(f"/api/v1/credit-cards/invoices/{inv_id}/").json()["payment_transaction"] == pay_tx.pk

    assert auth_client.post(f"/api/v1/transactions/{pay_tx.pk}/void/").status_code == 200
    assert auth_client.get(f"/api/v1/credit-cards/invoices/{inv_id}/").json()["payment_transaction"] is None


def test_recurring_generation_queries_do_not_grow_with_rules(auth_client, user):
    acc = make_account(user)
    horizon = add_months(today(), 24)
    new_rule(auth_client, user, acc)
    one = queries(lambda: ensure_generated(user, horizon))  # nada novo a gerar
    for name in ("Luz", "Água", "Academia"):
        new_rule(auth_client, user, acc, description=name)
    assert queries(lambda: ensure_generated(user, horizon)) == one


def test_recurring_generation_creates_missing_occurrences_for_every_rule(auth_client, user):
    acc = make_account(user)
    a = new_rule(auth_client, user, acc).json()["id"]
    b = new_rule(auth_client, user, acc, description="Luz", amount="80.00").json()["id"]
    T.objects.filter(recurring_rule_id=a, date__gt=today()).delete()  # simula buracos
    ensure_generated(user, add_months(today(), 24))
    assert T.objects.filter(recurring_rule_id=a).count() == T.objects.filter(recurring_rule_id=b).count() == 25
    occ = T.objects.filter(recurring_rule_id=b).first()
    assert (occ.category_id, occ.account_id, occ.amount, occ.status) == (cat(user).pk, acc.pk, 80, "pending")


def test_dashboard_summary_queries_do_not_grow_with_rules(auth_client, user):
    acc = make_account(user)
    url = f"/api/v1/dashboard/summary/?month={today():%Y-%m}"
    new_rule(auth_client, user, acc)
    one = queries(get_ok(auth_client, url))
    for name in ("Luz", "Água", "Academia"):
        new_rule(auth_client, user, acc, description=name, start_date=iso(today()))
    assert queries(get_ok(auth_client, url)) == one
