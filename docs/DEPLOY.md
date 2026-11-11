# NEXO — Publicação, Backup e Operação

> Para o guia completo passo a passo (18 seções) focado em **VPS Hostinger + Dokploy**, consulte o arquivo principal na raiz do repositório: **[`DEPLOY.md`](file:///c:/Users/Kayron%20Silva/Documents/gest%20finan/DEPLOY.md)**.

## Resumo Rápido da Arquitetura em Produção

```text
Internet ──443──▶ Traefik (Dokploy) ──80──▶ Caddy (CSP, HSTS, compressão, SPA React)
                                              ├── /api, /admin, /static ──▶ Django + Gunicorn (:8000 interno)
                                              └── demais rotas ──▶ SPA (/srv/index.html)
                                                                   Django ──▶ PostgreSQL 16 (:5432 interno)
```

## Comandos Rápidos (Standalone via Docker Compose)

Caso queira rodar sem Dokploy diretamente com Docker Compose (descomentando `ports` em `docker-compose.prod.yml` e definindo `CADDY_ADDRESS=${NEXO_DOMAIN}`):

```bash
cp .env.prod.example .env.prod
# Edite .env.prod com NEXO_DOMAIN, POSTGRES_PASSWORD, DJANGO_SECRET_KEY e EMAIL_HOST_PASSWORD
chmod 600 .env.prod

docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend python manage.py createsuperuser
```

## Backup e Teste de Restauração

```bash
# Gerar backup comprimido (permissão 600):
scripts/backup.sh backups 30

# Validar restauração em banco temporário (compara contagem das 11 tabelas + soma centavo a centavo):
scripts/restore_test.sh
```
