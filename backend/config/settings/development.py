from .base import *  # noqa: F401,F403
from .base import SECRET_KEY as _SECRET_KEY

DEBUG = os.environ.get("DJANGO_DEBUG", "True") == "True"  # noqa: F405
# Chave fixa apenas para desenvolvimento/testes; produção exige variável de ambiente.
SECRET_KEY = _SECRET_KEY or "dev-only-insecure-key-do-not-use-in-production-0123456789"

# O runserver abre uma thread por requisição: conexão persistente aqui vaza uma conexão por thread
# até estourar o limite do PostgreSQL ("too many clients"). A documentação do Django manda desligar em dev.
DATABASES["default"]["CONN_MAX_AGE"] = 0  # noqa: F405
