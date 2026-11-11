from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401,F403
from .base import MIDDLEWARE, SECRET_KEY, env_list  # noqa: F401

DEBUG = False

if not SECRET_KEY:
    raise ImproperlyConfigured("DJANGO_SECRET_KEY é obrigatória em produção.")
if not env_list("DJANGO_ALLOWED_HOSTS"):
    raise ImproperlyConfigured("DJANGO_ALLOWED_HOSTS é obrigatória em produção.")

SECURE_SSL_REDIRECT = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_AGE = 60 * 60 * 24 * 14  # 14 dias
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"

# Estáticos do admin servidos pelo próprio Django (coletados na construção da imagem).
MIDDLEWARE = [MIDDLEWARE[0], "whitenoise.middleware.WhiteNoiseMiddleware", *MIDDLEWARE[1:]]

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

# Cache compartilhado entre os processos do gunicorn: sem isto, o limite de tentativas de login
# seria contado por processo (3 workers = 3x mais tentativas). Tabela criada no entrypoint.
# O limite geral de requisições fica na memória local de cada processo (common/throttling.py).
CACHES = {
    "default": {"BACKEND": "django.core.cache.backends.db.DatabaseCache", "LOCATION": "nexo_cache"},
    "throttle_local": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "throttle-local"},
}
