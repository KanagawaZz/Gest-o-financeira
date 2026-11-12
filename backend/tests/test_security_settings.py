import json
from decimal import Decimal

import pytest
from django.urls import get_resolver
from rest_framework.test import APIClient

from apps.transactions.models import Transaction as T

from .helpers import cat, iso, make_account, today

PUBLIC = {
    "/api/v1/health/",
    "/api/v1/auth/csrf/",
    "/api/v1/auth/login/",
    "/api/v1/auth/register/",
    "/api/v1/auth/password-reset/",
    "/api/v1/auth/password-reset-confirm/",
    "/api/v1/schema/",
    "/api/v1/docs/",
}

LIST_ENDPOINTS = [
    "/api/v1/auth/me/", "/api/v1/auth/export/", "/api/v1/accounts/", "/api/v1/categories/", "/api/v1/transactions/",
    "/api/v1/transactions/summary/", "/api/v1/recurring/", "/api/v1/credit-cards/", "/api/v1/credit-cards/invoices/",
    "/api/v1/installments/", "/api/v1/installments/plans/", "/api/v1/installments/plans/summary/", "/api/v1/goals/",
    "/api/v1/audit/", "/api/v1/dashboard/summary/", "/api/v1/dashboard/projection/", "/api/v1/dashboard/onboarding/",
    "/api/v1/reports/summary/", "/api/v1/reports/export/csv/", "/api/v1/reports/export/pdf/",
]  # fmt: skip


@pytest.mark.parametrize("url", LIST_ENDPOINTS)
def test_every_endpoint_requires_authentication(client, url):
    assert client.get(url).status_code == 403


@pytest.mark.parametrize("url", ["/api/v1/dashboard/simulate/", "/api/v1/auth/password/", "/api/v1/auth/logout/", "/api/v1/installments/plans/preview/"])
def test_write_endpoints_require_authentication(client, url):
    assert client.post(url, {}, format="json").status_code == 403


def test_no_route_is_accidentally_public():
    """Toda rota de /api/v1/ que não esteja na lista pública precisa ter IsAuthenticated (padrão do DRF)."""
    from rest_framework.permissions import AllowAny

    open_routes = set()

    def walk(patterns, prefix=""):
        for p in patterns:
            if hasattr(p, "url_patterns"):
                walk(p.url_patterns, prefix + str(p.pattern))
            else:
                cls = getattr(p.callback, "cls", None) or getattr(p.callback, "view_class", None)
                perms = getattr(cls, "permission_classes", [])
                if AllowAny in perms:
                    open_routes.add("/" + prefix + str(p.pattern))

    walk(get_resolver().url_patterns)
    api_open = {r for r in open_routes if r.startswith("/api/v1/")}
    allowed = {r for r in api_open if any(r.startswith(pub.rstrip("/")) for pub in PUBLIC)}
    assert api_open == allowed, f"rotas abertas inesperadas: {api_open - allowed}"


def test_session_cookie_flags():
    from django.conf import settings

    assert settings.SESSION_COOKIE_HTTPONLY is True
    assert settings.SESSION_COOKIE_SAMESITE == "Lax"


def test_validation_errors_do_not_leak_internals(auth_client):
    r = auth_client.post("/api/v1/transactions/", {"type": "expense"}, format="json")
    assert r.status_code == 400
    body = json.dumps(r.json())
    assert "Traceback" not in body and "django" not in body.lower()


# ---------------------------------------------------------------- perfil, senha e exportação
def test_update_profile(auth_client):
    r = auth_client.patch("/api/v1/auth/me/", {"first_name": "Ana Maria", "email": "ana@exemplo.com"}, format="json")
    assert r.status_code == 200 and r.json()["first_name"] == "Ana Maria"
    assert auth_client.patch("/api/v1/auth/me/", {"email": "invalido"}, format="json").status_code == 400
    assert auth_client.patch("/api/v1/auth/me/", {"username": "root", "is_staff": True}, format="json").status_code == 200
    assert auth_client.get("/api/v1/auth/me/").json()["username"] == "ana"  # campos sensíveis são ignorados


def test_change_password_rules(auth_client, user):
    url = "/api/v1/auth/password/"
    bad = auth_client.post(url, {"current_password": "errada", "new_password": "NovaSenha-Segura-9"}, format="json")
    assert bad.status_code == 400 and "current_password" in bad.json()["error"]["details"]
    weak = auth_client.post(url, {"current_password": "senha-segura-123", "new_password": "123"}, format="json")
    assert weak.status_code == 400 and "new_password" in weak.json()["error"]["details"]
    ok = auth_client.post(url, {"current_password": "senha-segura-123", "new_password": "NovaSenha-Segura-9"}, format="json")
    assert ok.status_code == 204
    user.refresh_from_db()
    assert user.check_password("NovaSenha-Segura-9")
    assert auth_client.get("/api/v1/auth/me/").status_code == 200  # a sessão atual continua válida
    fresh = APIClient()
    assert fresh.post("/api/v1/auth/login/", {"username": "ana", "password": "senha-segura-123"}, format="json").status_code == 400


def test_export_contains_only_own_data(auth_client, user, other_user):
    acc = make_account(user, "Minha")
    T.objects.create(owner=user, type="expense", description="Meu gasto", amount=Decimal("10.00"), category=cat(user), account=acc, date=today())
    alheia = make_account(other_user, "Alheia")
    T.objects.create(owner=other_user, type="expense", description="Gasto alheio", amount=Decimal("99.00"), category=cat(other_user), account=alheia, date=today())

    r = auth_client.get("/api/v1/auth/export/")
    assert r.status_code == 200 and "attachment" in r["Content-Disposition"] and r["Cache-Control"] == "no-store"
    data = json.loads(r.content)
    assert [t["description"] for t in data["transactions"]] == ["Meu gasto"]
    assert [a["name"] for a in data["accounts"]] == ["Minha"]
    assert "password" not in json.dumps(data).lower()


def test_preview_matches_creation_and_persists_nothing(auth_client, user):
    from apps.installments.models import InstallmentPlan

    body = dict(total_amount="100.00", count=3, first_date=iso(today()))
    r = auth_client.post("/api/v1/installments/plans/preview/", body, format="json")
    assert r.status_code == 200 and [x["amount"] for x in r.json()["installments"]] == ["33.33", "33.33", "33.34"]
    assert r.json()["total"] == "100.00" and not InstallmentPlan.objects.exists()
    acc = make_account(user)
    plan = auth_client.post("/api/v1/installments/plans/", dict(body, description="X", category=cat(user, name="Compras").pk, account=acc.pk), format="json").json()
    assert [x["amount"] for x in plan["installments"]] == [x["amount"] for x in r.json()["installments"]]
    assert [x["date"] for x in r.json()["installments"]][0] == plan["installments"][0]["date"]


def test_openapi_schema_generates_without_request():
    """`check --deploy` gera o schema sem usuário logado; serializers não podem filtrar por AnonymousUser."""
    from drf_spectacular.generators import SchemaGenerator

    schema = SchemaGenerator().get_schema(request=None, public=True)
    assert "/api/v1/transactions/" in schema["paths"]
