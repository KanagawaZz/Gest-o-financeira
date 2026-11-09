from datetime import date, timedelta
from decimal import Decimal

from django.utils import timezone

from apps.accounts.models import FinancialAccount
from apps.categories.models import Category


def today() -> date:
    return timezone.localdate()


def iso(d: date) -> str:
    return d.isoformat()


def make_account(user, name="Conta", balance="1000.00") -> FinancialAccount:
    return FinancialAccount.objects.create(owner=user, name=name, initial_balance=Decimal(balance))


def cat(user, kind="expense", name=None) -> Category:
    name = name or ("Alimentação" if kind == "expense" else "Salário")
    return Category.objects.get(owner=user, kind=kind, name=name)


def balance(client, account) -> Decimal:
    return Decimal(client.get(f"/api/v1/accounts/{account.pk}/").json()["current_balance"])


def in_days(n: int) -> date:
    return today() + timedelta(days=n)
