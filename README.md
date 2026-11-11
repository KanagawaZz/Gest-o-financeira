# NEXO

Gestão financeira pessoal: contas, receitas e despesas, compromissos recorrentes, parcelamentos, cartões e faturas, projeção de saldo, simulador de compras, metas e relatórios (CSV/PDF).

- Produto: `NEXO_Plano_Desenvolvimento/` · Decisões de implementação: `PLANO_DE_IMPLEMENTACAO.md` · Publicação e backups: `docs/DEPLOY.md`
- Stack: Django 5.2 + DRF + PostgreSQL · React 19 + TypeScript strict + Vite + Tailwind + Recharts

## Rodar em desenvolvimento (Windows)

```powershell
# 1. Banco (PostgreSQL na porta 5433 do host; a 5432 costuma estar ocupada)
docker compose up -d --wait

# 2. Backend
cd backend
copy .env.example .env      # descomente a linha DATABASE_URL (Postgres do Docker)
.\.venv\Scripts\python.exe -m pip install -r requirements\dev.txt     # só na primeira vez
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py createsuperuser                  # seu usuário
.\.venv\Scripts\python.exe manage.py runserver                        # http://127.0.0.1:8000

# 3. Frontend (outro terminal)
cd frontend
npm install
npm run dev                                                           # http://localhost:5173
```

Quer ver a interface com dados prontos? Crie um usuário de demonstração (só funciona com `DEBUG=True`; apaga e recria o usuário `demo`):
```powershell
.\.venv\Scripts\python.exe manage.py seed_demo --password "uma-senha-sua"
```

Ou acesse diretamente `http://localhost:5173/cadastro` no navegador para criar uma conta nova. O sistema inicializa automaticamente o pacote de categorias financeiras para cada novo usuário. Novos cadastros podem ser ativados/desativados a qualquer momento pela variável `REGISTRATION_ENABLED` no `.env`.

Sem `DATABASE_URL`, o backend usa SQLite local, útil só para experimentos rápidos.

Porta 8000 ocupada por outro projeto? Suba o backend em outra porta e aponte o proxy do Vite para ela:
```powershell
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8010
$env:NEXO_API_PROXY="http://127.0.0.1:8010"; npm run dev                # no terminal do frontend
```

Abrir no celular (mesmo Wi-Fi): descubra o IP do computador (`ipconfig`, ex.: `192.168.1.8`), inclua-o no `backend/.env` e suba o Vite aberto para a rede. O backend continua só em `127.0.0.1`: o celular fala com o Vite, que repassa `/api`.
```powershell
# backend/.env
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,192.168.1.8
CSRF_TRUSTED_ORIGINS=http://localhost:5173,http://192.168.1.8:5173
# frontend
npm run dev -- --host 0.0.0.0                                         # no celular: http://192.168.1.8:5173
```
Só funciona na rede local, e qualquer aparelho do mesmo Wi-Fi alcança a tela de login enquanto o servidor estiver no ar. O IP pode mudar quando o roteador renova o endereço.

## Testes e verificações

```powershell
cd backend;  .\.venv\Scripts\python.exe -m pytest          # 126 testes (regras financeiras, segurança, API)
cd frontend; npm test; npm run lint; npm run build          # 44 testes (formulários, cálculos de período, telas)
```
Auditoria em navegador real (Edge via Playwright): login, todas as telas em 3 larguras, overflow horizontal, erros de console e acessibilidade (axe, WCAG 2 A/AA). Requer backend e frontend rodando e um usuário (ex.: o `demo`):
```powershell
cd frontend; $env:E2E_PASS="uma-senha-sua"; npm run audit:browser       # screenshots em frontend/e2e-shots
$env:TEMA="manha"; npm run audit:browser                               # força o período do tema cidade (manha|tarde|entardecer|noite)
$env:ESTILO="azul"; npm run audit:browser                              # audita o tema azul
node e2e/motion-check.mjs e2e-shots                                      # animações: sequência do painel, fps (inclusive CPU 4× lenta), reduzir movimento, modal
node e2e/background-sharpness.mjs                                       # qual arquivo de fundo cada tela usa e quanto amplia
node e2e/glass-contrast.mjs e2e-shots                                   # contraste real (sob as letras): 4 períodos do tema cidade + tema azul (FASES=azul limita)
```

API documentada (com login) em `http://127.0.0.1:8000/api/v1/docs/`.

## Regras que valem para todo o sistema
- Só lançamentos **realizados** alteram saldo; **pendentes** são previsões e compromissos.
- Compra no cartão é **despesa de consumo** e não mexe no saldo; o **pagamento da fatura** é só a saída de caixa e nunca conta como segunda despesa.
- Transferência entre contas não é receita nem despesa.
- Nada confirmado é apagado: realizado é **estornado**, e pendente gerado por regra, parcelamento ou cartão é **cancelado**. As alterações ficam na auditoria.
- Todo cálculo financeiro é feito no backend com `Decimal`; o frontend só formata.
