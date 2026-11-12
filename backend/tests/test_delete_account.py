"""Exclusão da própria conta (LGPD): exige senha, apaga tudo do titular e nada dos outros."""
from django.contrib.auth import get_user_model
from django.contrib.sessions.models import Session

from apps.accounts.models import FinancialAccount
from apps.audit.models import AuditLog
from apps.categories.models import Category
from apps.credit_cards.models import CreditCard, CreditCardInvoice
from apps.goals.models import Goal, GoalContribution
from apps.installments.models import InstallmentPlan
from apps.recurring.models import RecurringRule
from apps.transactions.models import Transaction

from .helpers import cat, iso, make_account, today
from .test_cards_installments import buy, make_card, make_plan
from .test_recurring import new_rule

URL = "/api/v1/auth/delete-account/"
PASSWORD = {"password": "senha-segura-123"}
OWNED = [FinancialAccount, Category, Transaction, RecurringRule, CreditCard, CreditCardInvoice, InstallmentPlan, Goal, GoalContribution, AuditLog]


def fill_everything(client, user):
    """Dados em todos os módulos, com as ligações que usam RESTRICT entre si."""
    acc, reserve = make_account(user), make_account(user, name="Reserva")
    new_rule(client, user, acc)
    make_plan(client, user, acc)
    card = make_card(client).json()["id"]
    buy(client, card, user, installments=3)
    inv = client.get("/api/v1/credit-cards/invoices/").json()["results"][-1]["id"]
    assert client.post(f"/api/v1/credit-cards/invoices/{inv}/pay/", {"account": acc.pk}, format="json").status_code == 200
    goal = client.post("/api/v1/goals/", {"name": "Viagem", "target_amount": "1000.00"}, format="json").json()["id"]
    body = {"amount": "100.00", "date": iso(today()), "account": acc.pk, "destination_account": reserve.pk}
    assert client.post(f"/api/v1/goals/{goal}/contributions/", body, format="json").status_code == 201
    body = dict(type="expense", description="Mercado", amount="50.00", category=cat(user).pk, account=acc.pk, date=iso(today()))
    assert client.post("/api/v1/transactions/", body, format="json").status_code == 201


def test_delete_account_removes_user_and_all_their_data(auth_client, user):
    fill_everything(auth_client, user)
    assert all(m.objects.filter(owner=user).exists() for m in OWNED)
    user_id = user.pk

    r = auth_client.post(URL, PASSWORD, format="json")

    assert r.status_code == 204
    assert not get_user_model().objects.filter(pk=user_id).exists()
    assert not any(m.objects.filter(owner_id=user_id).exists() for m in OWNED)
    assert Session.objects.count() == 0  # sessão encerrada
    assert auth_client.get("/api/v1/auth/me/").status_code == 403


def test_deleted_user_cannot_log_in_again(auth_client, user, client):
    assert auth_client.post(URL, PASSWORD, format="json").status_code == 204
    r = client.post("/api/v1/auth/login/", {"username": "ana", **PASSWORD}, format="json")
    assert r.status_code == 400


def test_delete_account_requires_the_current_password(auth_client, user):
    make_account(user)
    wrong = auth_client.post(URL, {"password": "errada"}, format="json")
    assert wrong.status_code == 400
    assert wrong.json()["error"]["details"] == {"password": ["Senha incorreta."]}
    assert auth_client.post(URL, {}, format="json").status_code == 400
    assert get_user_model().objects.filter(pk=user.pk).exists()
    assert FinancialAccount.objects.filter(owner=user).exists()
    assert auth_client.get("/api/v1/auth/me/").status_code == 200  # continua logado


def test_delete_account_does_not_touch_other_users(auth_client, user, other_user):
    other_acc = make_account(other_user)
    make_account(user)
    assert auth_client.post(URL, PASSWORD, format="json").status_code == 204
    assert get_user_model().objects.filter(pk=other_user.pk).exists()
    assert FinancialAccount.objects.filter(pk=other_acc.pk).exists()
    assert Category.objects.filter(owner=other_user).exists()


def test_delete_account_is_throttled_like_password_change(auth_client, user):
    for _ in range(5):
        auth_client.post(URL, {"password": "errada"}, format="json")
    r = auth_client.post(URL, PASSWORD, format="json")
    assert r.status_code == 429
    assert get_user_model().objects.filter(pk=user.pk).exists()


def test_admin_account_is_not_deleted_from_the_app(auth_client, user):
    user.is_staff = True
    user.save(update_fields=["is_staff"])
    r = auth_client.post(URL, PASSWORD, format="json")
    assert r.status_code == 400
    assert get_user_model().objects.filter(pk=user.pk).exists()
