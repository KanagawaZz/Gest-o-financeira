import pytest
from django.contrib.auth import get_user_model
from django.core.cache import caches
from rest_framework.test import APIClient


@pytest.fixture(autouse=True)
def _clear_cache():
    for alias in ("default", "throttle_local"):  # zera os limites de requisições entre testes
        caches[alias].clear()


@pytest.fixture
def user(db):
    return get_user_model().objects.create_user("ana", password="senha-segura-123", first_name="Ana")


@pytest.fixture
def other_user(db):
    return get_user_model().objects.create_user("beto", password="senha-segura-123")


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def auth_client(user):
    c = APIClient()
    c.force_login(user)
    return c
