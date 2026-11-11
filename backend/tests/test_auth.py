LOGIN = "/api/v1/auth/login/"


def test_login_ok_and_me(client, user):
    r = client.post(LOGIN, {"username": "ana", "password": "senha-segura-123"}, format="json")
    assert r.status_code == 200
    assert r.json()["username"] == "ana"
    assert client.get("/api/v1/auth/me/").status_code == 200


def test_login_invalid_uses_generic_message(client, user):
    wrong_pw = client.post(LOGIN, {"username": "ana", "password": "x"}, format="json")
    unknown = client.post(LOGIN, {"username": "ninguem", "password": "x"}, format="json")
    assert wrong_pw.status_code == unknown.status_code == 400
    assert wrong_pw.json() == unknown.json()
    assert wrong_pw.json()["error"]["code"] == "invalid_credentials"


def test_login_is_throttled(client, user):
    for _ in range(5):
        client.post(LOGIN, {"username": "ana", "password": "errada"}, format="json")
    r = client.post(LOGIN, {"username": "ana", "password": "senha-segura-123"}, format="json")
    assert r.status_code == 429
    assert r.json()["error"]["code"] == "throttled"


def test_general_limit_lives_in_local_memory_and_login_limit_stays_shared(client, auth_client, user):
    """O limite geral não grava no cache compartilhado (banco em produção) a cada clique;
    o de login continua no compartilhado, para valer igual entre os processos do Gunicorn."""
    from django.core.cache import caches

    assert auth_client.get("/api/v1/auth/me/").status_code == 200
    assert caches["throttle_local"].get(f"throttle_user_{user.pk}")
    assert caches["default"].get(f"throttle_user_{user.pk}") is None

    client.post(LOGIN, {"username": "ana", "password": "errada"}, format="json")
    assert caches["default"].get("throttle_login_127.0.0.1")


def test_general_user_limit_still_applies(auth_client, monkeypatch):
    from common.throttling import LocalUserRateThrottle

    monkeypatch.setattr(LocalUserRateThrottle, "THROTTLE_RATES", {"user": "2/min"})  # taxa baixa só neste teste
    assert [auth_client.get("/api/v1/auth/me/").status_code for _ in range(3)] == [200, 200, 429]


def test_me_requires_auth(client):
    assert client.get("/api/v1/auth/me/").status_code == 403


def test_logout(auth_client):
    assert auth_client.post("/api/v1/auth/logout/").status_code == 204
    assert auth_client.get("/api/v1/auth/me/").status_code == 403


def test_csrf_endpoint_sets_cookie():
    from rest_framework.test import APIClient

    r = APIClient(enforce_csrf_checks=True).get("/api/v1/auth/csrf/")
    assert r.status_code == 200
    assert "csrftoken" in r.cookies


REGISTER = "/api/v1/auth/register/"


def test_register_get_status(client):
    r = client.get(REGISTER)
    assert r.status_code == 200
    assert r.json() == {"enabled": True}


def test_register_ok_creates_user_seeds_categories_and_logs_in(client, db):
    from django.contrib.auth import get_user_model
    from apps.categories.models import Category

    User = get_user_model()
    payload = {
        "username": "novousuario",
        "email": "novo@exemplo.com",
        "first_name": "Novo Usuário",
        "password": "uma-senha-bem-segura-123",
    }
    r = client.post(REGISTER, payload, format="json")
    assert r.status_code == 201
    data = r.json()
    assert data["username"] == "novousuario"
    assert data["email"] == "novo@exemplo.com"
    assert data["first_name"] == "Novo Usuário"

    # Confere persistência no banco
    created = User.objects.get(username="novousuario")
    assert created.check_password("uma-senha-bem-segura-123")

    # Confere sessão autenticada automaticamente
    assert client.get("/api/v1/auth/me/").status_code == 200

    # Confere que categorias padrão foram geradas
    cats = Category.objects.filter(owner=created)
    assert cats.filter(kind="expense").count() >= 10
    assert cats.filter(kind="income").count() >= 5


def test_register_rejects_duplicate_username(client, user):
    payload = {
        "username": "ana",  # já existe
        "email": "outro@exemplo.com",
        "password": "outra-senha-segura-123",
    }
    r = client.post(REGISTER, payload, format="json")
    assert r.status_code == 400
    assert "username" in r.json()["error"]["details"]


def test_register_rejects_duplicate_email(client, user):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    user.email = "ana@exemplo.com"
    user.save(update_fields=["email"])

    payload = {
        "username": "outro_usuario",
        "email": "ana@exemplo.com",
        "password": "outra-senha-segura-123",
    }
    r = client.post(REGISTER, payload, format="json")
    assert r.status_code == 400
    assert "email" in r.json()["error"]["details"]


def test_register_validates_password_strength(client, db):
    payload = {
        "username": "usuario_fraco",
        "password": "123",  # muito curta
    }
    r = client.post(REGISTER, payload, format="json")
    assert r.status_code == 400
    assert "password" in r.json()["error"]["details"]


def test_register_disabled_returns_403(client, db, settings):
    settings.REGISTRATION_ENABLED = False
    assert client.get(REGISTER).json() == {"enabled": False}

    payload = {
        "username": "tentativa",
        "password": "senha-segura-longa-123",
    }
    r = client.post(REGISTER, payload, format="json")
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "registration_disabled"


def test_password_reset_flow(client, user, mailoutbox):
    from django.contrib.auth import get_user_model
    from django.contrib.auth.tokens import default_token_generator
    from django.utils.http import urlsafe_base64_encode
    from django.utils.encoding import force_bytes

    User = get_user_model()
    user.email = "recuperar@exemplo.com"
    user.save(update_fields=["email"])

    # 1. Solicita redefinição
    r = client.post("/api/v1/auth/password-reset/", {"email": "recuperar@exemplo.com"}, format="json")
    assert r.status_code == 200
    assert len(mailoutbox) == 1
    email = mailoutbox[0]
    assert "NEXO — Redefinição de senha" in email.subject
    assert user.email in email.to

    # 2. Solicita para email inexistente (não falha, não vaza dados)
    r2 = client.post("/api/v1/auth/password-reset/", {"email": "naoexiste@exemplo.com"}, format="json")
    assert r2.status_code == 200

    # 3. Confirma redefinição com token válido
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)

    r3 = client.post(
        "/api/v1/auth/password-reset-confirm/",
        {"uid": uid, "token": token, "new_password": "nova-senha-segura-123"},
        format="json",
    )
    assert r3.status_code == 200

    # Verifica se consegue logar com a nova senha
    user.refresh_from_db()
    assert user.check_password("nova-senha-segura-123")


def test_password_reset_invalid_token(client, user):
    from django.utils.http import urlsafe_base64_encode
    from django.utils.encoding import force_bytes

    uid = urlsafe_base64_encode(force_bytes(user.pk))
    r = client.post(
        "/api/v1/auth/password-reset-confirm/",
        {"uid": uid, "token": "token-falso-invalido", "new_password": "nova-senha-segura-123"},
        format="json",
    )
    assert r.status_code == 400
    assert "token" in r.json()["error"]["details"]


def test_authenticated_post_without_csrf_token_is_rejected(user):
    from rest_framework.test import APIClient

    c = APIClient(enforce_csrf_checks=True)
    c.force_login(user)
    r = c.post("/api/v1/categories/", {"name": "Sem CSRF", "kind": "expense"}, format="json")
    assert r.status_code == 403
