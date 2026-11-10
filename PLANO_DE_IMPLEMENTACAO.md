# NEXO — Plano de Implementação e Estado Atual

Deriva de `NEXO_Plano_Desenvolvimento/PLANO_DE_DESENVOLVIMENTO.md`. Aquele documento define o **quê**; este registra **como** foi construído, o que está pronto e **o que falta**. Em conflito, prevalece o plano de desenvolvimento.

> **Estado em 09/11/2026:** Etapas 0 a 7 concluídas (todas as funcionalidades do plano, com testes). Etapa 8 (qualidade e publicação) concluída **até onde dá sem o servidor**: imagens Docker, HTTPS, backup e teste de restauração prontos e verificados localmente. **Falta publicar** (ver §5).

## 1. Etapas

| Etapa | Conteúdo | Estado |
|---|---|---|
| 0 Ambiente | Django/DRF, React/TS strict/Vite/Tailwind, Postgres via Docker (porta 5433) | ✅ |
| 1 Fundação | Login por sessão + CSRF, limite de tentativas, layout responsivo, componentes base | ✅ |
| 2 Base financeira | Contas, categorias (padrão do plano §4.6), receitas/despesas/transferências, filtros, estorno | ✅ |
| 3 Dashboard | 6 indicadores com explicação, receitas × despesas, despesas por categoria, vencimentos, alertas | ✅ |
| 4 Recorrentes | Regras semanal/mensal/anual/personalizada, geração idempotente, pagar/cancelar, contas pontuais | ✅ |
| 5 Parcelamentos e cartões | Parcelas exatas (centavos na última), quitação antecipada, cartões, faturas, pagamento sem dupla contagem | ✅ |
| 6 Projeções | 3/6/12/24 meses, confirmado × estimado, saldo conservador, composição de cada mês, simulador sem gravar | ✅ |
| 7 Metas e relatórios | Metas com aportes reais (transferências), relatórios por período, comparação mensal, CSV e PDF | ✅ |
| 8 Qualidade e publicação | Testes, auditoria em navegador real, acessibilidade, Docker, Caddy/HTTPS, backup + restauração | ✅ local · ⏳ publicação |

## 2. Decisões de implementação

| Tema | Decisão | Motivo |
|---|---|---|
| Livro-caixa único | Parcelas e ocorrências recorrentes são `Transaction` **pendentes** (não tabelas paralelas `Installment`/`FinancialObligation`) | Uma fonte de verdade; impossível contar duas vezes |
| Cartão | Compra = despesa sem conta (não mexe no saldo); pagamento = `card_payment` (saída de caixa, fora do consumo); pagar liquida as compras; estornar o pagamento reabre a fatura | Plano §4.5 (regra crítica) |
| Transferência | Um registro origem → destino | Sem pares inconsistentes |
| Status | `pending`, `realized`, `voided` (estorno), `cancelled` (pendência de regra/plano/cartão) | Nada confirmado some; canceladas não são recriadas |
| Idempotência | Únicos no banco: (regra, data), (plano, nº parcela), 1 pagamento ativo por fatura | Plano §6.4 |
| Integridade | `CHECK` no banco: valor > 0, formato de transferência, conta XOR cartão; FKs `RESTRICT` | Defesa além do serializer |
| Saldo | Sempre derivado (inicial + realizados); nunca gravado | Sem divergência |
| Visões | **Consumo** por data do lançamento (pendente + realizado) × **Caixa** (saldos e projeção; fatura no vencimento) | Plano §4.5 e §5 |
| Recorrência | Gera do mês atual até +24 meses; frequência/início imutáveis após criar; editar só afeta futuras pendentes com confirmação | Plano §4.2 |
| Auditoria | `AuditLog` para criação/edição/estorno/cancelamento, pagamento e reabertura de fatura, quitação, regras, senha | Plano §6.5 |
| Autenticação | Sessão Django + CSRF; login 5/min; senha 5/min; troca de senha encerra outras sessões | Plano §10 |
| Cores de gráfico | Séries `#5A96D2`/`#CF7752` + 6 categóricas validadas com `validate_palette.js` | A paleta oficial (baixa saturação) reprova em distinção de séries |
| Tema visual (10/11/2026) | Referência aprovada pelo usuário: escuro, verde-esmeralda `#22C58B` como cor de ação, foto da cidade (`frontend/src/assets/hero-cidade.webp`) fixa atrás de tudo e cards em vidro fosco (`.surface`, `.surface-strong`, `.glass-field` em `index.css`); só a barra lateral é sólida (degradê) | Substitui a paleta azul de `PALETA_DE_CORES.md`. Os nomes dos tokens (`marinho`, `aco`, `suave`…) foram mantidos e mudaram de valor |
| Tema pelo horário (10/11/2026, refinado no mesmo dia) | A **foto original é a protagonista** em todos os períodos: nítida, sem véu branco, sem blur, sem perder cor; cada período só acrescenta um leve tom de luz (azul de manhã, dourado à tarde, nada no entardecer, azul profundo à noite). A leitura é resolvida nas superfícies: cards, modais e menus em vidro translúcido (blur só no próprio card) e menu lateral em degradê tirado das cores da foto. Cores de texto **escopadas**: claras sobre a foto (com halo local nas letras), grafite/azul profundo dentro do vidro claro. Períodos pelo sol real em Cuiabá (`frontend/src/lib/daylight.ts`, conferido com a fórmula NOAA): manhã, tarde, entardecer (vidro claro) e noite (vidro azul-marinho). Em Configurações → Aparência: pelo horário (padrão) ou um período fixo | Briefings do usuário de 10/11/2026 |
| Fundo e vidro fumê (10/11/2026) | Foto da Ponte Estaiada (2560×1255, enviada pelo usuário) como `<img>` independente com `object-fit: cover`, `<picture>` com AVIF/WebP e recortes próprios para celular (580×1255) e tablet em pé (941×1255); `sizes="max(100vw, 204vh)"` porque, com cover, a foto é dimensionada pela altura. Overlay escuro só por região (atrás dos títulos e no rodapé). Cards, modais, menus e campos em **vidro fumê** com tom por período; menu lateral e barras do celular seguem claros de dia | Briefing do usuário: foto nítida, cards sem aspecto leitoso |
| Movimento (10/11/2026) | Tokens únicos (`src/lib/motion.ts` e `--dur-*`/`--ease-out` no CSS): 150/240 ms para interface, 1,1 s para dados, uma curva de desaceleração. Momento principal: a carga do painel (valores contam em centavos inteiros de 0 ao valor real; barras, linhas e rosca do Recharts se constroem; progresso preenche). Gráficos só montam as séries quando entram na tela. Páginas entram com fade e 6px; modal entra/sai com fade e escala; avisos entram de lado; skeletons no lugar de "Carregando…". Tudo respeita "reduzir movimento" | Briefing do usuário de animações |
| Segundo tema: Azul (10/11/2026) | Em Configurações → Aparência o usuário escolhe o **tema** (por aparelho, `localStorage` `nexo.estilo`): **Cidade** (foto + vidro fumê, com os períodos do dia) ou **Azul**, na linguagem do app do Nubank com azul no lugar do roxo: fundo branco sem foto, cards cinza-claro (`#f0f1f5`) sem borda nem sombra, texto quase preto, azul `#0a53d1` (o roxo `#820ad1` girado para o azul, mesma saturação e luz) em botões-pílula, item ativo e links, barra superior do celular e tela de entrada em azul cheio; verde/vermelho continuam sendo entrada/saída de dinheiro. Não muda com o horário. Implementação: `frontend/src/tema-azul.css` só redefine as variáveis do tema cidade sob `:root[data-fase='azul']` (por isso brilhos, sombras e cores de estado do `index.css` viraram variáveis); gráficos ganharam paleta clara validada (`CHART_LIGHT` em `src/lib/chart.ts`); logo e avatar leem as cores do tema; a foto nem é baixada. Não foi copiado logotipo, nome ou ícone do Nubank | Pedido do usuário: segunda opção de tema "como o Nubank, mas azul" |
| Celular primeiro | Uso principal no celular: barra inferior (Início, Transações, +, Cartões, Mais), indicadores em 2 colunas, botão de recarregar e metas de app instalado no iPhone (`viewport-fit=cover`, ícone da tela inicial) | O app instalado no iPhone não tem barra do navegador nem "puxar para atualizar" |
| Cores de texto | Variantes `*-t` (ex.: `cinza-t`, `queimado-t`) com contraste AA sobre o vidro; botão primário com texto escuro sobre o verde | Branco sobre o verde não chega a 4,5:1 |
| Fonte (10/11/2026) | **Hanken Grotesk** (variável, licença aberta OFL) hospedada no próprio app, nos dois temas. O usuário pediu a fonte do app do Nubank: a atual é a **Nu Sans**, exclusiva do Nubank, e a anterior era a **Graphik**, comercial paga; nenhuma pode ser distribuída aqui. Hanken Grotesk foi a mais próxima entre as abertas testadas (Albert Sans, Hanken Grotesk, Inter, Figtree, Onest) que tem **numerais tabulares** (Albert Sans, a mais parecida no desenho, não tem, e os valores "dançariam" na contagem animada). Substituiu a Roboto Condensed | Pedido do usuário; hospedagem própria permite CSP restritiva, sem Google Fonts |
| Indicadores do painel | Mini-gráfico de 6 meses com dados reais (`trends` no resumo) | Decoração com cara de tendência engana num app financeiro |
| Valores digitados | `1.234,56`, `487,5` e `50` são aceitos; `1.200` (sem vírgula) é recusado por ser ambíguo | Melhor pedir correção do que adivinhar errado |

## 3. Verificação feita

- **Backend:** 126 testes no PostgreSQL, sem avisos. Cobrem os 7 cenários de integração do plano §14, isolamento entre usuários em todos os módulos, constraints do banco, CSV seguro contra injeção de fórmula, PDF, exportação, senha, o fato de nenhuma rota ser pública por engano e a geração do schema OpenAPI sem usuário (exigida pelo `check --deploy`).
- **Frontend:** 44 testes (formulários, períodos, escala dos mini-gráficos, renderização de todas as telas com dados simulados) e build. O lint (oxlint) não roda em máquinas com Controle de Aplicativo do Windows, que bloqueia o binário nativo.
- **Navegador real (Edge/Playwright):** 9 telas × 3 larguras (1366, 768 e 390 px), sem overflow horizontal, sem erro de servidor e **0 violações axe WCAG 2 A/AA**. As capturas foram revisadas.
- **Fluxos clicados no navegador (09/11/2026):** pagar fatura (saldo cai exatamente o total; consumo do mês inalterado), quitar parcelamento (saldo cai o restante) e guardar dinheiro em meta (saldo total e consumo inalterados; meta sobe o valor do aporte), sem erros de página ou servidor.
- **Produção:** `check --deploy` sem erros nem pendências de segurança (resta só HSTS *preload*, desligado de propósito). Container sobe *healthy*; HTTP→HTTPS, host inválido recusado, 403 sem login, estáticos servidos.
- **Backup:** ciclo backup → restauração em banco temporário → comparação executado de verdade (11 tabelas, soma idêntica). O controle negativo também falha como deve.

## 4. Limitações conhecidas (decisões ou simplificações)

1. **Resolução da foto de fundo:** a foto tem 1255 px de altura. Não há ampliação em notebooks e Full HD; em 2K (1,15×), ultrawide (1,34×), 4K (1,72×), tablets (1,2–1,6×) e celulares (~2×) o navegador amplia. Para nitidez total nessas telas, substituir `frontend/src/assets/fundo/` por versões geradas de um original da mesma foto com ≥ 2600 px de altura (ex.: 5300×2600); conferir com `node e2e/background-sharpness.mjs`. Confirmar também a licença de uso da foto.
2. **Tema:** dois temas em Configurações → Aparência. Cidade acompanha o período do dia pelo sol (ou fica fixo em um período); Azul é claro e não tem versão escura. Configurações mostra moeda (BRL), data (dd/mm/aaaa) e fuso (America/Cuiaba) como fixos, sem edição.
2. **Ícone de categoria** não é escolhível na interface, só a cor (o campo existe na API).
3. **Quitação antecipada** liquida as parcelas pelo valor nominal; não registra desconto.
4. **Simulador** não tem botão "registrar esta compra"; o parcelamento é criado à parte.
5. **Importação** de dados não existe; há exportação JSON e restauração via `pg_restore`.
6. **Documentação OpenAPI:** 6 endpoints do tipo `APIView` (dashboard, perfil, senha, relatórios) aparecem sem esquema de corpo (aviso `drf_spectacular.W002`). Não afeta o funcionamento.
7. **Fluxos clicados no navegador:** pagar fatura, quitar e aportar foram clicados ponta a ponta em 09/11/2026 (ver §3), mas esse roteiro não está automatizado no repositório; o `audit:browser` cobre login, navegação, abas, menu e modais.

## 5. O que falta para terminar

Tudo abaixo depende de você (servidor, domínio, contas externas). O passo a passo está em `docs/DEPLOY.md`.

- [ ] **Contratar/preparar a VPS** com Docker e liberar as portas 80/443.
- [ ] **Domínio:** apontar um registro A para a VPS.
- [ ] **Criar `.env.prod`** a partir de `.env.prod.example` (domínio, senha do banco, `DJANGO_SECRET_KEY` aleatória).
- [ ] **Subir:** `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build` e criar seu usuário (`createsuperuser`).
- [ ] **Agendar backup diário** (cron) e **configurar a cópia externa** (rclone + `RCLONE_DEST`).
- [ ] **Rodar o primeiro `scripts/restore_test.sh` no servidor** e agendar semanalmente.
- [ ] **Monitor de disponibilidade** apontando para `https://SEU_DOMINIO/api/v1/health/`.
- [ ] **Teste de aceitação manual** no navegador e no celular com seus dados reais: cadastrar despesa, criar parcelamento, comprar no cartão e pagar a fatura, conferir o dashboard.

Melhorias opcionais (não exigidas para considerar o sistema pronto): itens 1 a 6 de §4, e corrigir o aviso de lint em `frontend/src/app/routes/router.tsx` movendo `ProtectedRoute` para um arquivo próprio.
