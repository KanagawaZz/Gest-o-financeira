# Guia Completo de Implantação em Produção — NEXO (Hostinger VPS + Dokploy)

Este documento detalha o passo a passo completo e operacional para implantar, monitorar, atualizar e manter o sistema **NEXO** em uma **VPS da Hostinger** utilizando o **Dokploy** via **Docker Compose**.

---

## Arquitetura de Produção no Dokploy

```text
Internet (HTTPS :443 / HTTP :80)
   │
   ▼
[Traefik — Proxy Reverso do Dokploy] (Termina TLS / Let's Encrypt automático)
   │  (Rede interna Docker: X-Forwarded-Proto: https -> porta 80)
   ▼
[Serviço: web (Caddy 2 + SPA React/Vite)]
   ├── /healthz                ──▶ Responde 200 OK (Healthcheck do container web)
   ├── /api/*, /admin/*, /static/* ──▶ Reverse Proxy interno para backend:8000
   └── /* (demais rotas)       ──▶ Entrega o bundle estático React (/srv/index.html)
                                       │
                                       ▼
                        [Serviço: backend (Django 5.2 + Gunicorn + WhiteNoise)]
                           ├── Executa migrações com pg_advisory_lock no boot
                           ├── Cria tabela de cache compartilhado (nexo_cache)
                           └── Conecta via rede interna ao banco db:5432
                                       │
                                       ▼
                        [Serviço: db (PostgreSQL 16 Alpine)]
                           └── Volume persistente: nexo_pgdata (Sem porta pública)
```

---

## 1. Pré-requisitos da VPS (Hostinger)

1. **Plano recomendado na Hostinger:**
   - **KVM 1** (1 vCPU, 4 GB RAM, 50 GB NVMe) ou **KVM 2** (2 vCPUs, 8 GB RAM, 100 GB NVMe). A aplicação foi otimizada para rodar com folga a partir de 2 GB de RAM.
2. **Sistema Operacional:**
   - **Ubuntu 24.04 LTS** (64-bit) — ou escolha diretamente o template **"Ubuntu 24.04 with Dokploy"** no painel hPanel da Hostinger.
3. **Firewall e Portas na VPS:**
   - **Porta 22 (TCP):** SSH (restrinja ou use chave SSH).
   - **Porta 80 (TCP):** HTTP (usada pelo Traefik do Dokploy para validação ACME/Let's Encrypt e redirecionamento para HTTPS).
   - **Porta 443 (TCP/UDP):** HTTPS (tráfego público da aplicação).
   - **Porta 3000 (TCP):** Painel administrativo do Dokploy (recomenda-se vincular um domínio HTTPS ao próprio Dokploy nas configurações iniciais e depois fechar a porta 3000 no firewall da Hostinger).
   - **NÃO abra a porta 5432 (PostgreSQL) nem a 8000 (Gunicorn)** no firewall. Ambas operam estritamente na rede interna do Docker.
4. **DNS do Domínio:**
   - Crie um registro do tipo **A** no provedor de DNS do seu domínio apontando para o **IP público IPv4 da VPS Hostinger**:
     - Exemplo: `Tipo: A` | `Nome: nexo` (ou `@` para domínio raiz) | `Valor: <IP_DA_VPS>` | `TTL: 300`.

---

## 2. Configuração Inicial do Dokploy

Caso não tenha escolhido o template pronto da Hostinger com Dokploy pré-instalado:

1. Conecte-se à VPS via SSH:
   ```bash
   ssh root@<IP_DA_VPS>
   ```
2. Instale o Dokploy com o script oficial:
   ```bash
   curl -sSL https://dokploy.com/install.sh | sh
   ```
3. Acesse `http://<IP_DA_VPS>:3000` no navegador, crie sua conta de administrador do Dokploy e configure (em **Settings → Server**) um domínio administrativo e e-mail para emissão de certificados Let's Encrypt.

---

## 3. Organização dos Serviços

O projeto utiliza um único arquivo de orquestração de produção ([`docker-compose.prod.yml`](file:///c:/Users/Kayron%20Silva/Documents/gest%20finan/docker-compose.prod.yml)) que gerencia 3 containers isolados:

| Serviço | Imagem / Dockerfile | Porta Interna | Porta Externa (Host) | Função |
| :--- | :--- | :--- | :--- | :--- |
| **`db`** | `postgres:16-alpine` | `5432` | *Nenhuma* | Banco de dados relacional principal com volume persistente `nexo_pgdata`. |
| **`backend`** | [`backend/Dockerfile`](file:///c:/Users/Kayron%20Silva/Documents/gest%20finan/backend/Dockerfile) | `8000` | *Nenhuma* | API Django 5.2 + DRF + Gunicorn (2 workers × 2 threads) + WhiteNoise. |
| **`web`** | [`deploy/web.Dockerfile`](file:///c:/Users/Kayron%20Silva/Documents/gest%20finan/deploy/web.Dockerfile) | `80` | Roteada pelo Traefik (`443`) | Build estático do React 19/Vite + servidor Caddy 2 com headers de segurança, compressão `zstd`/`gzip` e proxy reverso para `/api/*`, `/admin/*` e `/static/*`. |

> **Por que não há Redis ou Celery?**
> A aplicação não possui filas assíncronas pesadas e utiliza `DatabaseCache` (`nexo_cache` no PostgreSQL) para compartilhar o controle de *rate-limiting* entre os processos do Gunicorn. Isso economiza ~150 MB a 300 MB de RAM na VPS sem perder segurança nem performance.

---

## 4. Configuração do Repositório Git no Dokploy

1. Suba o código-fonte deste projeto para um repositório privado no **GitHub** (ou GitLab/Gitea).
2. No painel do Dokploy:
   - Vá em **Git** (menu lateral) e conecte sua conta do GitHub via **GitHub App** (ou configure uma **SSH Deploy Key**).
3. Vá em **Projects** → clique em **Create Project** → nomeie como `NEXO`.
4. Dentro do projeto `NEXO`, clique em **Create Service** → selecione **Compose** (Docker Compose):
   - **Name:** `nexo-stack`
   - **Compose Type:** `Docker Compose`
5. Na aba **General** do serviço recém-criado:
   - **Provider:** Selecione `GitHub` (ou `Git` se usar chave SSH).
   - **Repository:** Selecione o repositório do projeto.
   - **Branch:** `main` (ou `master`, conforme seu branch principal).
   - **Compose Path:** `./docker-compose.prod.yml`
6. Clique em **Save**.

---

## 5. Configuração das Variáveis de Ambiente

No painel do Dokploy, dentro do serviço `nexo-stack`, acesse a aba **Environment** e cole as variáveis abaixo (baseadas no arquivo [`.env.prod.example`](file:///c:/Users/Kayron%20Silva/Documents/gest%20finan/.env.prod.example)), substituindo pelos valores reais de produção:

```env
# 1. Domínio público (sem https:// e sem barra no final)
NEXO_DOMAIN=financas.seudominio.com.br

# 2. Senha forte para o PostgreSQL (apenas letras e números para evitar conflito na URL de conexão)
POSTGRES_PASSWORD=GereUmaSenhaForteComPeloMenos32CaracteresAlfanumericos

# 3. Chave secreta criptográfica do Django (mínimo de 50 caracteres aleatórios)
DJANGO_SECRET_KEY=GereUmaChaveAleatoriaLongaComMaisDe50CaracteresAqui

# 4. Controle de auto-cadastro de novos usuários (True = aberto; False = bloqueado)
REGISTRATION_ENABLED=True

# 5. Configuração de E-mail (Recuperação de senha via Gmail SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=kayronsilva.ofc@gmail.com
EMAIL_HOST_PASSWORD=cole-aqui-a-senha-de-app-do-google
DEFAULT_FROM_EMAIL=NEXO <kayronsilva.ofc@gmail.com>

# 6. Dimensionamento do Gunicorn para VPS (2 workers x 2 threads)
GUNICORN_WORKERS=2
GUNICORN_THREADS=2
GUNICORN_TIMEOUT=60

# 7. Endereço interno do Caddy (MANTENHA :80 no Dokploy)
CADDY_ADDRESS=:80
```

### Como gerar segredos seguros rapidamente no terminal:
```bash
# Gerar POSTGRES_PASSWORD (32 caracteres alfanuméricos):
openssl rand -hex 16

# Gerar DJANGO_SECRET_KEY (64 bytes URL-safe):
python3 -c "import secrets; print(secrets.token_urlsafe(64))"
```

Clique em **Save** na aba **Environment** do Dokploy.

---

## 6. Configuração do PostgreSQL

O banco de dados PostgreSQL 16 já está configurado como serviço `db` dentro do [`docker-compose.prod.yml`](file:///c:/Users/Kayron%20Silva/Documents/gest%20finan/docker-compose.prod.yml):
- **Banco:** `nexo`
- **Usuário:** `nexo`
- **Senha:** Injetada via `${POSTGRES_PASSWORD}`
- **String de conexão interna (usada pelo `backend`):** `postgres://nexo:${POSTGRES_PASSWORD}@db:5432/nexo`
- **Pool / Persistência de conexão:** O Django está configurado com `conn_max_age=60` e `conn_health_checks=True` em [`backend/config/settings/base.py`](file:///c:/Users/Kayron%20Silva/Documents/gest%20finan/backend/config/settings/base.py), reutilizando conexões TCP entre requisições e descartando automaticamente conexões ociosas caso o banco reinicie.

---

## 7. Configuração dos Volumes Persistentes

O arquivo [`docker-compose.prod.yml`](file:///c:/Users/Kayron%20Silva/Documents/gest%20finan/docker-compose.prod.yml) declara três volumes nomeados gerenciados pelo Docker da VPS:
1. **`nexo_pgdata`** → montado em `/var/lib/postgresql/data` no container `db`. **Armazena todos os dados do PostgreSQL.**
2. **`caddy_data`** → montado em `/data` no container `web`.
3. **`caddy_config`** → montado em `/config` no container `web`.

> **Importante:** Esses volumes persistem no disco da VPS mesmo quando os containers são recriados, atualizados ou reiniciados pelo Dokploy. **Nunca** marque a opção *"Delete Volumes"* no Dokploy ao remover ou reconstruir o serviço.

---

## 8. Configuração dos Domínios no Dokploy

Para que o Traefik do Dokploy encaminhe o tráfego externo para o container `web`:

1. Dentro do serviço `nexo-stack` no Dokploy, clique na aba **Domains**.
2. Clique em **Add Domain** e preencha:
   - **Service Name:** Selecione **`web`** (não selecione `backend` nem `db`, pois o `web`/Caddy já serve o frontend e faz o proxy de `/api/*`, `/admin/*` e `/static/*` para o `backend`).
   - **Host:** `financas.seudominio.com.br` (deve ser idêntico ao valor colocado em `NEXO_DOMAIN`).
   - **Path:** `/`
   - **Container Port:** `80`
   - **HTTPS:** Habilitado (**ON**)
   - **Certificate Provider:** `Let's Encrypt`
3. Clique em **Create / Save**.

---

## 9. Configuração do HTTPS

- **Na borda (Traefik / Dokploy):** Ao ativar `HTTPS: ON` e `Certificate Provider: Let's Encrypt` na aba **Domains**, o Traefik emite e renova automaticamente o certificado TLS para o seu domínio e redireciona requisições `http://` (porta 80) para `https://` (porta 443).
- **Na comunicação interna (Traefik → Caddy → Django):**
  - O arquivo [`deploy/Caddyfile`](file:///c:/Users/Kayron%20Silva/Documents/gest%20finan/deploy/Caddyfile) possui `trusted_proxies static private_ranges`, garantindo que o cabeçalho `X-Forwarded-Proto: https` enviado pelo Traefik seja preservado até o Django.
  - O Django em [`backend/config/settings/production.py`](file:///c:/Users/Kayron%20Silva/Documents/gest%20finan/backend/config/settings/production.py) valida `SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")`, emite cookies `Secure`, `HttpOnly` e `SameSite=Lax`, e aplica HSTS de 1 ano (`max-age=31536000; includeSubDomains; preload`).

---

## 10. Configuração do Build

Todo o processo de build é multi-stage e ocorre automaticamente dentro dos Dockerfiles:
- **Backend ([`backend/Dockerfile`](file:///c:/Users/Kayron%20Silva/Documents/gest%20finan/backend/Dockerfile)):**
  - Base `python:3.13-slim`.
  - Instala dependências de `requirements/production.txt` (`Django`, `djangorestframework`, `psycopg[binary]`, `gunicorn`, `whitenoise`, `reportlab`, etc.).
  - Normaliza quebras de linha do `entrypoint.sh` (`CRLF` → `LF`), executa `python manage.py collectstatic --noinput` e define o usuário sem privilégios `nexo`.
- **Frontend + Proxy ([`deploy/web.Dockerfile`](file:///c:/Users/Kayron%20Silva/Documents/gest%20finan/deploy/web.Dockerfile)):**
  - **Estágio 1 (`node:22-alpine`):** Executa `npm ci` e `npm run build` (`tsc -b && vite build`), gerando os bundles otimizados e divididos (`vendor-react`, `vendor-charts`, páginas sob demanda) em `/app/dist`.
  - **Estágio 2 (`caddy:2-alpine`):** Copia apenas os artefatos estáticos compilados (`/app/dist` → `/srv`) e o [`deploy/Caddyfile`](file:///c:/Users/Kayron%20Silva/Documents/gest%20finan/deploy/Caddyfile), resultando em uma imagem final enxuta (~45 MB).

---

## 11. Deploy Inicial

1. Com o repositório Git, variáveis de ambiente (`Environment`) e domínio (`Domains`) configurados no Dokploy:
2. Vá na aba **General** do serviço `nexo-stack`.
3. Clique no botão **Deploy**.
4. Acompanhe o progresso na aba **Deployments** / **Logs**:
   - O Dokploy fará o `git clone` do branch configurado, construirá as imagens `backend` e `web`, iniciará o `db` (aguardando `pg_isready`), iniciará o `backend` (executando migrações e aguardando o healthcheck `/api/v1/health/`) e finalmente subirá o `web`.

---

## 12. Execução das Migrações

As migrações são executadas **automaticamente e de forma controlada** na inicialização do container `backend` através do script [`backend/entrypoint.sh`](file:///c:/Users/Kayron%20Silva/Documents/gest%20finan/backend/entrypoint.sh):
- Antes de rodar `manage.py migrate --noinput` e `manage.py createcachetable`, o script adquire um **Advisory Lock no PostgreSQL** (`pg_advisory_lock(78901234)`).
- Isso garante que, mesmo se houver mais de uma réplica ou reinicialização concorrente, apenas uma instância executará as migrações por vez, sem risco de corrupção de schema ou *race conditions*.

Se desejar verificar o status das migrações manualmente via terminal SSH na VPS ou console do Dokploy:
```bash
docker exec -it $(docker ps -qf "name=backend") python manage.py showmigrations
```

---

## 13. Criação do Superusuário Django

Após o primeiro deploy concluir com sucesso:

1. Acesse a VPS via SSH (ou abra o terminal do container `backend` pelo painel do Dokploy na aba **Docker** / **Terminal**):
   ```bash
   docker exec -it $(docker ps -qf "name=backend") python manage.py createsuperuser
   ```
2. Informe o `username`, `email` e `password` quando solicitado.
3. Caso queira que as categorias financeiras padrão sejam criadas para o seu usuário, você também pode criar sua conta diretamente pela tela pública `https://<SEU_DOMINIO>/cadastro` (que já semeia automaticamente as 17 categorias padrão de receitas e despesas).

---

## 14. Verificação dos Serviços (Checklist Pós-Deploy)

Execute os testes abaixo para confirmar que todos os componentes estão saudáveis:

1. **Status dos Containers e Healthchecks (via SSH na VPS):**
   ```bash
   docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
   ```
   *Resultado esperado:* Os 3 containers (`db`, `backend` e `web`) devem exibir `(healthy)` na coluna `STATUS`, e nenhuma porta `5432` ou `8000` deve estar exposta em `0.0.0.0`.
2. **Healthcheck Público da API e Banco de Dados:**
   ```bash
   curl -i https://financas.seudominio.com.br/api/v1/health/
   ```
   *Resultado esperado:* `HTTP/2 200` com corpo `{"status": "ok"}` e cabeçalhos `strict-transport-security`, `content-security-policy`, `x-content-type-options: nosniff`, `x-frame-options: DENY`.
3. **Proteção de Endpoints Privados:**
   ```bash
   curl -i https://financas.seudominio.com.br/api/v1/accounts/
   ```
   *Resultado esperado:* `HTTP/2 403` (ou `401`) com mensagem em português exigindo autenticação.
4. **Teste Funcional no Navegador:**
   - Acesse `https://financas.seudominio.com.br`.
   - Crie uma conta em `/cadastro` (ou faça login em `/login`).
   - Teste o envio de recuperação de senha em `/recuperar-senha` e verifique o recebimento do e-mail com o link `https://financas.seudominio.com.br/redefinir-senha?uid=...&token=...`.

---

## 15. Verificação dos Logs

- **Pelo painel do Dokploy:**
  - Acesse o projeto `NEXO` → serviço `nexo-stack` → aba **Logs** e selecione o container desejado (`web`, `backend` ou `db`).
- **Via SSH na VPS:**
  ```bash
  # Ver logs em tempo real do backend (Gunicorn + Django Audit/Requests)
  docker logs -f --tail 100 $(docker ps -qf "name=backend")

  # Ver logs do proxy/frontend (Caddy)
  docker logs -f --tail 100 $(docker ps -qf "name=web")
  ```
- **Rotação de Logs:** Configurada automaticamente em [`docker-compose.prod.yml`](file:///c:/Users/Kayron%20Silva/Documents/gest%20finan/docker-compose.prod.yml) com driver `json-file` limitado a `10m` por arquivo e máximo de `3` arquivos por container (máximo de 30 MB por serviço).

---

## 16. Procedimento de Atualização

Sempre que novas alterações forem enviadas ao branch principal (`git push origin main`):

1. **Realize um backup preventivo do banco** antes de atualizar (veja a Seção 18).
2. **No painel do Dokploy:**
   - Clique em **Deploy** no serviço `nexo-stack` (ou ative o **Auto Deploy** na aba *General* para que todo `push` no GitHub acione o deploy automaticamente via webhook).
3. O Docker Compose reconstruirá apenas as camadas alteradas, aplicará eventuais novas migrações de forma segura no boot do `backend` e substituirá os containers sem perda dos dados armazenados em `nexo_pgdata`.

---

## 17. Procedimento de Rollback

Caso uma atualização apresente problemas em produção:

1. **Rollback de Código (Aplicação):**
   - No Git, reverta para o commit estável anterior (`git revert HEAD` e `git push`, ou no Dokploy altere temporariamente o campo **Branch / Commit** para a tag/commit anterior e clique em **Deploy**).
2. **Rollback de Banco de Dados (se houve migração destrutiva):**
   - Caso a versão defeituosa tenha alterado o banco de forma incompatível, restaure o dump gerado imediatamente antes do deploy seguindo o procedimento da **Seção 18**.

---

## 18. Backup e Restauração

O projeto inclui dois scripts prontos em [`scripts/backup.sh`](file:///c:/Users/Kayron%20Silva/Documents/gest%20finan/scripts/backup.sh) e [`scripts/restore_test.sh`](file:///c:/Users/Kayron%20Silva/Documents/gest%20finan/scripts/restore_test.sh).

### 18.1. Executar Backup Manual ou Agendado na VPS

Na VPS Hostinger, crie um diretório externo aos volumes da aplicação (por exemplo, `/var/backups/nexo`) e agende no `cron` do usuário `root`:

```bash
mkdir -p /var/backups/nexo
chmod 700 /var/backups/nexo
```

Para executar um backup manual a qualquer momento no servidor com Dokploy:
```bash
docker exec -i $(docker ps -qf "name=db") pg_dump -U nexo -d nexo -Fc --no-owner > /var/backups/nexo/nexo-$(date +%Y%m%d-%H%M%S).dump
```

Para automatizar diariamente às 03:00 da manhã (mantendo 30 dias de retenção local e enviando cópia externa via `rclone` caso configurado):
```bash
crontab -e
```
Adicione a linha:
```cron
0 3 * * * docker exec -i $(docker ps -qf "name=db") pg_dump -U nexo -d nexo -Fc --no-owner > /var/backups/nexo/nexo-$(date +\%Y\%m\%d-\%H\%M\%S).dump && find /var/backups/nexo -name 'nexo-*.dump' -mtime +30 -delete
```
*(Dica: Você também pode usar o recurso nativo **Backups** do próprio painel Dokploy ou configurar o `rclone copy /var/backups/nexo gdrive:nexo-backups` para manter cópias fora da VPS Hostinger).*

### 18.2. Testar a Integridade do Backup (Sem Afetar Produção)

O script [`scripts/restore_test.sh`](file:///c:/Users/Kayron%20Silva/Documents/gest%20finan/scripts/restore_test.sh) cria um banco temporário `nexo_restore_test`, restaura o arquivo `.dump`, compara a contagem de linhas de todas as 11 tabelas e a soma exata (`coalesce(sum(amount), 0)`) dos lançamentos financeiros centavo a centavo com o banco ativo, e apaga o banco temporário ao final:

```bash
# Definir o comando compose correspondente ao projeto no Dokploy ou standalone:
COMPOSE="docker compose -p <nome-do-projeto-dokploy>" ./scripts/restore_test.sh /var/backups/nexo/nexo-AAAAMMDD-HHMMSS.dump
```

### 18.3. Restauração Real em Caso de Desastre

1. Pare temporariamente o container `backend` para encerrar conexões ativas com o banco:
   ```bash
   docker stop $(docker ps -qf "name=backend")
   ```
2. Restaure o arquivo `.dump` desejado com `pg_restore`:
   ```bash
   docker exec -i $(docker ps -qf "name=db") pg_restore -U nexo -d nexo --clean --if-exists --no-owner < /var/backups/nexo/nexo-AAAAMMDD-HHMMSS.dump
   ```
3. Inicie novamente o container `backend`:
   ```bash
   docker start $(docker ps -qf "name=backend")
   ```

