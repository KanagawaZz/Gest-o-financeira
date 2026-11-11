#!/bin/sh
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  # Usa advisory lock no PostgreSQL (quando aplicável) para evitar migrações concorrentes em múltiplas instâncias
  python - <<'PY'
import os, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")
django.setup()
from django.core.management import call_command
from django.db import connection

if connection.vendor == "postgresql":
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_lock(78901234)")
    try:
        call_command("migrate", interactive=False)
        call_command("createcachetable")
    finally:
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_unlock(78901234)")
else:
    call_command("migrate", interactive=False)
    call_command("createcachetable")
PY
fi

exec gunicorn config.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers "${GUNICORN_WORKERS:-2}" \
  --threads "${GUNICORN_THREADS:-2}" \
  --timeout "${GUNICORN_TIMEOUT:-60}" \
  --graceful-timeout 30 \
  --keep-alive 5 \
  --max-requests 1000 \
  --max-requests-jitter 100 \
  --access-logfile - \
  --error-logfile - \
  --forwarded-allow-ips="*"
