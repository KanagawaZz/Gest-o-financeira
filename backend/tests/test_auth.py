import pytest

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


def test_authenticated_post_without_csrf_token_is_rejected(user):
    from rest_framework.test import APIClient

    c = APIClient(enforce_csrf_checks=True)
    c.force_login(user)
    r = c.post("/api/v1/categories/", {"name": "Sem CSRF", "kind": "expense"}, format="json")
    assert r.status_code == 403
