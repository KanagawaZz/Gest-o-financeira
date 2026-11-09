from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import FinancialAccount
from apps.categories.models import Category
from apps.transactions.models import Transaction

URL = "/api/v1/transactions/"


@pytest.fixture
def conta(user):
    return FinancialAccount.objects.create(owner=user, name="Conta", initial_balance=Decimal("1000.00"))


@pytest.fixture
def reserva(user):
    return FinancialAccount.objects.create(owner=user, name="Reserva", initial_balance=Decimal("0.00"))


@pytest.fixture
def cat_despesa(user):
    return Category.objects.get(owner=user, kind="expense", name="Alimentação")


@pytest.fixture
def cat_receita(user):
    return Category.objects.get(owner=user, kind="income", name="Salário")


def saldo(client, account):
    r = client.get(f"/api/v1/accounts/{account.pk}/")
    return Decimal(r.json()["current_balance"])


def criar(client, **kw):
    kw.setdefault("date", "2026-11-05")
    return client.post(URL, kw, format="json")


def test_balance_follows_income_expense_and_transfer(auth_client, conta, reserva, cat_despesa, cat_receita):
    assert criar(auth_client, type="income", description="Salário", amount="3200.00", category=cat_receita.pk, account=conta.pk).status_code == 201
    assert criar(auth_client, type="expense", description="Mercado", amount="487.52", category=cat_despesa.pk, account=conta.pk).status_code == 201
    assert criar(auth_client, type="transfer", description="Guardar", amount="500.00", account=conta.pk, destination_account=reserva.pk).status_code == 201

    assert saldo(auth_client, conta) == Decimal("1000.00") + Decimal("3200.00") - Decimal("487.52") - Decimal("500.00")
    assert saldo(auth_client, reserva) == Decimal("500.00")


def test_transfer_is_not_income_or_expense_in_summary(auth_client, conta, reserva, cat_despesa):
    criar(auth_client, type="expense", description="Mercado", amount="100.00", category=cat_despesa.pk, account=conta.pk)
    criar(auth_client, type="transfer", description="Guardar", amount="900.00", account=conta.pk, destination_account=reserva.pk)
    s = auth_client.get(URL + "summary/").json()
    assert s["expense_realized"] == "100.00"
    assert s["income_realized"] == "0.00"


def test_pending_does_not_change_balance_until_realized(auth_client, conta, cat_despesa):
    r = criar(auth_client, type="expense", description="Luz", amount="200.00", category=cat_despesa.pk, account=conta.pk, status="pending")
    assert r.status_code == 201 and r.json()["settled_date"] is None
    assert saldo(auth_client, conta) == Decimal("1000.00")
    assert auth_client.get(URL + "summary/").json()["expense_pending"] == "200.00"

    r2 = auth_client.patch(f"{URL}{r.json()['id']}/", {"status": "realized", "settled_date": "2026-11-10"}, format="json")
    assert r2.status_code == 200 and r2.json()["settled_date"] == "2026-11-10"
    assert saldo(auth_client, conta) == Decimal("800.00")


def test_realized_defaults_settled_date_to_date(auth_client, conta, cat_despesa):
    r = criar(auth_client, type="expense", description="X", amount="10.00", category=cat_despesa.pk, account=conta.pk)
    assert r.json()["settled_date"] == "2026-11-05"


def test_void_restores_balance_and_keeps_history(auth_client, conta, cat_despesa):
    tx_id = criar(auth_client, type="expense", description="Mercado", amount="300.00", category=cat_despesa.pk, account=conta.pk).json()["id"]
    assert saldo(auth_client, conta) == Decimal("700.00")

    r = auth_client.post(f"{URL}{tx_id}/void/")
    assert r.status_code == 200 and r.json()["status"] == "voided" and r.json()["voided_at"]
    assert saldo(auth_client, conta) == Decimal("1000.00")
    assert Transaction.objects.filter(pk=tx_id).exists()
    assert auth_client.get(URL + "summary/").json()["expense_realized"] == "0.00"

    assert auth_client.post(f"{URL}{tx_id}/void/").status_code == 409  # não estorna duas vezes
    assert auth_client.patch(f"{URL}{tx_id}/", {"description": "x"}, format="json").status_code == 400


def test_realized_cannot_be_deleted_pending_can(auth_client, conta, cat_despesa):
    done = criar(auth_client, type="expense", description="A", amount="10.00", category=cat_despesa.pk, account=conta.pk).json()["id"]
    pend = criar(auth_client, type="expense", description="B", amount="10.00", category=cat_despesa.pk, account=conta.pk, status="pending").json()["id"]
    r = auth_client.delete(f"{URL}{done}/")
    assert r.status_code == 409 and "estorno" in r.json()["error"]["message"]
    assert Transaction.objects.filter(pk=done).exists()
    assert auth_client.delete(f"{URL}{pend}/").status_code == 204


@pytest.mark.parametrize("amount", ["0", "0.00", "-5.00"])
def test_amount_must_be_positive(auth_client, conta, cat_despesa, amount):
    r = criar(auth_client, type="expense", description="X", amount=amount, category=cat_despesa.pk, account=conta.pk)
    assert r.status_code == 400


def test_category_must_match_type(auth_client, conta, cat_receita):
    r = criar(auth_client, type="expense", description="X", amount="10.00", category=cat_receita.pk, account=conta.pk)
    assert r.status_code == 400 and "category" in r.json()["error"]["details"]


def test_transfer_rules(auth_client, conta, reserva, cat_despesa):
    same = criar(auth_client, type="transfer", description="X", amount="1.00", account=conta.pk, destination_account=conta.pk)
    assert same.status_code == 400
    no_dest = criar(auth_client, type="transfer", description="X", amount="1.00", account=conta.pk)
    assert no_dest.status_code == 400
    with_cat = criar(auth_client, type="transfer", description="X", amount="1.00", account=conta.pk, destination_account=reserva.pk, category=cat_despesa.pk)
    assert with_cat.status_code == 400
    dest_on_expense = criar(auth_client, type="expense", description="X", amount="1.00", category=cat_despesa.pk, account=conta.pk, destination_account=reserva.pk)
    assert dest_on_expense.status_code == 400


def test_cannot_use_archived_account_or_other_users_objects(auth_client, user, other_user, conta, cat_despesa):
    conta.is_archived = True
    conta.save()
    assert criar(auth_client, type="expense", description="X", amount="1.00", category=cat_despesa.pk, account=conta.pk).status_code == 400

    alheia = FinancialAccount.objects.create(owner=other_user, name="Alheia")
    r = criar(auth_client, type="expense", description="X", amount="1.00", category=cat_despesa.pk, account=alheia.pk)
    assert r.status_code == 400

    cat_alheia = Category.objects.get(owner=other_user, kind="expense", name="Lazer")
    ok_account = FinancialAccount.objects.create(owner=user, name="Outra")
    assert criar(auth_client, type="expense", description="X", amount="1.00", category=cat_alheia.pk, account=ok_account.pk).status_code == 400


def test_transactions_isolated_between_users(auth_client, other_user):
    alheia = FinancialAccount.objects.create(owner=other_user, name="Alheia")
    cat = Category.objects.get(owner=other_user, kind="expense", name="Lazer")
    tx = Transaction.objects.create(owner=other_user, type="expense", description="Privado", amount=Decimal("5.00"),
                                    category=cat, account=alheia, date="2026-11-01")
    assert auth_client.get(f"{URL}{tx.pk}/").status_code == 404
    assert auth_client.post(f"{URL}{tx.pk}/void/").status_code == 404
    assert auth_client.get(URL).json()["count"] == 0
    other = APIClient()
    other.force_login(other_user)
    assert other.get(URL).json()["count"] == 1


def test_filters_search_and_ordering(auth_client, conta, reserva, cat_despesa, cat_receita):
    criar(auth_client, type="expense", description="Supermercado", amount="50.00", category=cat_despesa.pk, account=conta.pk, date="2026-10-20")
    criar(auth_client, type="income", description="Salário", amount="3000.00", category=cat_receita.pk, account=conta.pk, date="2026-11-01")
    criar(auth_client, type="transfer", description="Reserva", amount="100.00", account=conta.pk, destination_account=reserva.pk, date="2026-11-02")

    def ids(**params):
        return [t["description"] for t in auth_client.get(URL, params).json()["results"]]

    assert ids(type="income") == ["Salário"]
    assert ids(date_from="2026-11-01") == ["Reserva", "Salário"]  # padrão: mais recentes primeiro
    assert ids(date_to="2026-10-31") == ["Supermercado"]
    assert ids(category=cat_despesa.pk) == ["Supermercado"]
    assert ids(search="super") == ["Supermercado"]
    assert set(ids(account=reserva.pk)) == {"Reserva"}  # filtra também pela conta de destino
    assert ids(ordering="amount") == ["Supermercado", "Reserva", "Salário"]
    assert auth_client.get(URL, {"type": "invalido"}).status_code == 400
    assert auth_client.get(URL, {"date_from": "ontem"}).status_code == 400


def test_db_constraints_block_invalid_rows(user, conta, cat_despesa):
    from django.db import IntegrityError, transaction

    with pytest.raises(IntegrityError), transaction.atomic():
        Transaction.objects.create(owner=user, type="expense", description="X", amount=Decimal("0"),
                                   category=cat_despesa, account=conta, date="2026-11-01")
    with pytest.raises(IntegrityError), transaction.atomic():
        Transaction.objects.create(owner=user, type="transfer", description="X", amount=Decimal("1"),
                                   account=conta, destination_account=conta, date="2026-11-01")


def test_history_blocks_deleting_account_or_category_but_not_the_whole_user(user, conta, cat_despesa):
    from django.db.models import RestrictedError

    Transaction.objects.create(owner=user, type="expense", description="X", amount=Decimal("1.00"),
                               category=cat_despesa, account=conta, date="2026-11-01")
    with pytest.raises(RestrictedError):
        conta.delete()
    with pytest.raises(RestrictedError):
        cat_despesa.delete()

    user.delete()  # remover o usuário apaga tudo em cascata, sem erro
    assert not Transaction.objects.exists()
    assert not FinancialAccount.objects.filter(pk=conta.pk).exists()


def test_archived_category_in_use_stays_on_existing_transaction(auth_client, conta, cat_despesa):
    tx_id = criar(auth_client, type="expense", description="Mercado", amount="10.00", category=cat_despesa.pk, account=conta.pk).json()["id"]
    cat_despesa.is_archived = True
    cat_despesa.save()
    r = auth_client.patch(f"{URL}{tx_id}/", {"description": "Mercado do mês"}, format="json")
    assert r.status_code == 200 and r.json()["category"] == cat_despesa.pk
