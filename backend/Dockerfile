FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 DJANGO_SETTINGS_MODULE=config.settings.production
WORKDIR /app

COPY requirements/base.txt requirements/production.txt requirements/
RUN pip install --no-cache-dir -r requirements/production.txt

COPY . .
# Estáticos gerados na construção (o usuário de execução não tem permissão de escrita em /app).
# A chave abaixo existe só durante este passo e não vai para a imagem final em uso.
RUN DJANGO_SECRET_KEY=build-only DJANGO_ALLOWED_HOSTS=build python manage.py collectstatic --noinput \
 && useradd --system --create-home nexo && chmod +x entrypoint.sh
USER nexo

EXPOSE 8000
# Simula a requisição que chega pelo Caddy (Host do domínio + HTTPS), sem afrouxar ALLOWED_HOSTS nem o redirect.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD python -c "import os,sys,urllib.request as u; h=os.environ['DJANGO_ALLOWED_HOSTS'].split(',')[0]; r=u.urlopen(u.Request('http://127.0.0.1:8000/api/v1/health/', headers={'Host': h, 'X-Forwarded-Proto': 'https'}), timeout=4); sys.exit(0 if r.status == 200 else 1)"
ENTRYPOINT ["./entrypoint.sh"]
