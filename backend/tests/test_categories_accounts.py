from apps.categories.models import Category
from apps.categories.services import DEFAULT_EXPENSE, DEFAULT_INCOME, seed_default_categories


def test_default_categories_seeded_on_user_creation(user):
    assert Category.objects.filter(owner=user, kind="expense").count() == len(DEFAULT_EXPENSE)
    assert Category.objects.filter(owner=user, kind="income").count() == len(DEFAULT_INCOME)


def test_seed_is_idempotent(user):
    before = Category.objects.filter(owner=user).count()
    seed_default_categories(user)
    assert Category.objects.filter(owner=user).count() == before


def test_category_crud_and_archive_instead_of_delete(auth_client, user):
    r = auth_client.post("/api/v1/categories/", {"name": "Pets", "kind": "expense", "color": "#112233"}, format="json")
    assert r.status_code == 201
    cid = r.json()["id"]
    assert auth_client.delete(f"/api/v1/categories/{cid}/").status_code == 204
    assert Category.objects.get(pk=cid).is_archived is True


def test_category_duplicate_name_rejected(auth_client):
    r = auth_client.post("/api/v1/categories/", {"name": "moradia", "kind": "expense"}, format="json")
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "validation_error"


def test_category_invalid_color_rejected(auth_client):
    r = auth_client.post("/api/v1/categories/", {"name": "X", "kind": "expense", "color": "azul"}, format="json")
    assert r.status_code == 400


def test_categories_isolated_between_users(auth_client, other_user):
    other_cat = Category.objects.filter(owner=other_user).first()
    assert auth_client.get(f"/api/v1/categories/{other_cat.pk}/").status_code == 404
    ids = {c["id"] for c in auth_client.get("/api/v1/categories/").json()["results"]}
    assert other_cat.pk not in ids


def test_account_create_balance_and_isolation(auth_client, other_user):
    r = auth_client.post(
        "/api/v1/accounts/", {"name": "Nubank", "type": "checking", "initial_balance": "1500.50"}, format="json"
    )
    assert r.status_code == 201
    assert r.json()["current_balance"] == "1500.50"
    acc_id = r.json()["id"]

    from rest_framework.test import APIClient

    intruder = APIClient()
    intruder.force_login(other_user)
    assert intruder.get(f"/api/v1/accounts/{acc_id}/").status_code == 404
    assert intruder.patch(f"/api/v1/accounts/{acc_id}/", {"name": "x"}, format="json").status_code == 404


def test_account_owner_cannot_be_forged(auth_client, user, other_user):
    r = auth_client.post(
        "/api/v1/accounts/", {"name": "Forjada", "owner": other_user.pk}, format="json"
    )
    assert r.status_code == 201
    from apps.accounts.models import FinancialAccount

    assert FinancialAccount.objects.get(pk=r.json()["id"]).owner == user


def test_account_requires_auth(client):
    assert client.get("/api/v1/accounts/").status_code == 403
