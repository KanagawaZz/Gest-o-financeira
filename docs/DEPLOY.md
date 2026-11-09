# NEXO — Publicação, backup e operação

Arquitetura em produção (um único servidor):

```
Internet ──443──▶ Caddy (HTTPS automático, CSP, frontend)
                     ├── /api, /admin, /static ──▶ Django + gunicorn (sem porta pública)
                     └── demais rotas ──▶ SPA (index.html)
                                         Django ──▶ PostgreSQL (sem porta pública)
```

## 1. Pré-requisitos
- VPS Linux com Docker e Docker Compose (2 GB de RAM bastam).
- Um domínio (ou subdomínio) com registro **A** apontando para o IP do servidor. O Caddy só emite o certificado depois que o DNS resolver.
- Portas 80 e 443 liberadas no firewall. **Não** libere a 5432.

## 2. Primeira publicação
```bash
git clone <seu-repositório> /opt/nexo && cd /opt/nexo
cp .env.prod.example .env.prod
# edite .env.prod: NEXO_DOMAIN, POSTGRES_PASSWORD e DJANGO_SECRET_KEY
python3 -c "import secrets; print(secrets.token_urlsafe(64))"   # gere a chave
chmod 600 .env.prod

docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.prod ps          # backend deve ficar "healthy"

# seu usuário de acesso (único)
docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend python manage.py createsuperuser
```
Acesse `https://SEU_DOMINIO`. As migrações rodam sozinhas a cada inicialização.

O que a configuração de produção garante (testado com `manage.py check --deploy` e com o container no ar):
`DEBUG=False`; a aplicação não sobe sem `DJANGO_SECRET_KEY`; HTTP → HTTPS; HSTS de 1 ano; cookies de sessão e CSRF só por HTTPS; host fora do `ALLOWED_HOSTS` é recusado; banco e backend sem porta pública; CSP restritiva no Caddy; documentação da API só para usuário logado; logs com método, caminho e status (sem valores).

## 3. Atualizar
```bash
cd /opt/nexo && git pull
scripts/backup.sh                                  # sempre antes de atualizar
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

## 4. Backups
```bash
scripts/backup.sh                 # gera backups/nexo-AAAAMMDD-HHMMSS.dump (formato custom, comprimido, permissão 600)
scripts/backup.sh backups 30      # pasta e dias de retenção (padrão: 30)
```
**Agende diariamente** (`crontab -e`):
```
0 3 * * *  cd /opt/nexo && scripts/backup.sh >> backups/backup.log 2>&1
```
**Cópia fora do servidor** (plano §10): instale e configure o [rclone](https://rclone.org/) e defina o destino:
```
0 3 * * *  cd /opt/nexo && RCLONE_DEST="meu-remoto:nexo-backups" scripts/backup.sh >> backups/backup.log 2>&1
```
Os arquivos não são criptografados: use um destino privado (ou um remoto `crypt` do rclone).

## 5. Teste de restauração (obrigatório)
"Backup só é confiável depois de um teste de restauração." O script restaura num banco **temporário**, compara a contagem de linhas de todas as tabelas e a soma dos valores, e apaga o banco temporário. O banco real não é tocado.
```bash
scripts/restore_test.sh                          # usa o backup mais recente
scripts/restore_test.sh backups/nexo-....dump    # um arquivo específico
```
Saída esperada: `RESTAURAÇÃO VERIFICADA: o backup é confiável.` (exit 0). Qualquer divergência sai com exit 1.
Agende, por exemplo, toda segunda-feira:
```
30 3 * * 1  cd /opt/nexo && scripts/restore_test.sh >> backups/restore-test.log 2>&1
```
Esse ciclo foi executado de verdade no desenvolvimento: 11 tabelas e 173 lançamentos restaurados, soma idêntica centavo a centavo. Também testei o controle negativo: uma linha apagada depois do backup faz o teste falhar.

### Restaurar de fato (desastre)
```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod stop backend
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T db \
  pg_restore -U nexo -d nexo --clean --if-exists --no-owner < backups/nexo-....dump
docker compose -f docker-compose.prod.yml --env-file .env.prod start backend
```

## 6. Monitoramento
- `GET https://SEU_DOMINIO/api/v1/health/` → `{"status":"ok"}` (200) ou 503 se o banco cair. Não expõe dados.
- Cadastre essa URL num monitor de disponibilidade gratuito (UptimeRobot, Better Stack, Healthchecks.io) com alerta por e-mail.
- O container `backend` tem healthcheck próprio; `docker compose ... ps` mostra `healthy`/`unhealthy`.
- Logs: `docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f backend web`.

## 7. Checklist pós-publicação
- [ ] `https://` abre com cadeado; `http://` redireciona.
- [ ] `/api/v1/accounts/` sem login responde 403.
- [ ] Login funciona; após 5 tentativas erradas em 1 minuto, é bloqueado temporariamente.
- [ ] Backup diário e cópia externa agendados; primeiro `restore_test.sh` executado com sucesso.
- [ ] Monitor de disponibilidade apontando para `/api/v1/health/`.
