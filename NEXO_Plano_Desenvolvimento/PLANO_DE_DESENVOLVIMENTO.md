# NEXO — Plano de Desenvolvimento Completo
## Sistema de Gestão Financeira Pessoal

**Versão:** 1.0  
**Tipo:** Aplicação web privada, de uso individual  
**Objetivo:** organizar, controlar e planejar as finanças pessoais com clareza e facilidade.

> **Diretriz do produto:** o NEXO deve permitir que o usuário entenda sua situação financeira rapidamente, registre movimentações sem esforço e saiba quanto já está comprometido e quanto deverá sobrar nos próximos meses.

---

## 1. Visão do produto

O NEXO será uma aplicação web para centralizar receitas, despesas, contas recorrentes, parcelamentos, cartões de crédito, metas e relatórios.

O sistema será alimentado manualmente. Não haverá integração bancária na primeira versão.

### Perguntas que o sistema deve responder
- Quanto tenho disponível agora?
- Quanto já entrou e quanto já saiu neste mês?
- Quanto ainda falta pagar?
- Quais compromissos vencem em breve?
- Quanto da minha renda está comprometida?
- Quanto devo ter disponível no fim do mês?
- Como ficarão minhas finanças nos próximos 3, 6 e 12 meses?
- Quais categorias estão consumindo mais dinheiro?

### Princípios
1. **Simplicidade:** tarefas comuns devem exigir poucos passos.
2. **Clareza:** separar valores pagos, pendentes, previstos e projetados.
3. **Precisão:** cálculos financeiros centralizados no backend.
4. **Previsibilidade:** mostrar compromissos futuros e impacto de novas compras.
5. **Confiabilidade:** preservar histórico, evitar duplicidades e manter backups.
6. **Privacidade:** acesso individual protegido e dados não expostos.

---

## 2. Identidade visual e design system

### 2.1 Direção visual

A interface deve transmitir confiança, tranquilidade, organização e sofisticação. Evitar neon intenso, gradientes exagerados, excesso de transparência e excesso de informação na mesma tela.

**Referência estética:** software financeiro premium, minimalismo contemporâneo e dashboards de produtividade.

### 2.2 Paleta oficial

| Nome | Hex | Uso |
|---|---|---|
| Azul-marinho | `#111C2C` | Fundo principal |
| Azul aço | `#263B55` | Superfícies, sidebar e cards |
| Azul suave | `#6D91B5` | Ações principais, links e destaques |
| Verde-sálvia | `#A5B9A9` | Saldo positivo, sucesso e progresso |
| Branco suave | `#F1F4F8` | Texto principal |
| Cinza azulado | `#9BAABD` | Texto secundário |
| Âmbar discreto | `#D5B77A` | Atenção e vencimentos próximos |
| Vermelho queimado | `#C98282` | Despesas em destaque, atrasos e erros |

**Regra:** azul suave é a cor de ação; verde-sálvia indica resultado positivo. Âmbar e vermelho devem ser usados com moderação. Nunca comunicar status apenas por cor: incluir texto ou ícone.

### 2.3 Tipografia e componentes

- Fonte sugerida: Inter.
- Valores em Real brasileiro: `R$ 3.200,00`.
- Títulos com peso médio; valores importantes com destaque sem exagero.
- Bordas discretas, cantos consistentes e espaçamento generoso.
- Componentes reutilizáveis: cards, botões, campos, selects, tabelas, badges, modais, gráficos, alertas, barras de progresso e estados vazios.
- Ícones Lucide, com rótulos textuais sempre que a ação não for óbvia.

### 2.4 Layout responsivo

**Desktop:** sidebar fixa, cabeçalho compacto e conteúdo em grid.  
**Tablet:** sidebar recolhível e cards em duas colunas.  
**Celular:** navegação compacta, listas no lugar de tabelas largas e formulários simplificados.

A experiência mobile deve ser planejada desde o início, não tratada como ajuste final.

---

## 3. Navegação

Menu principal:
1. Dashboard
2. Contas
3. Transações
4. Parcelamentos
5. Cartões
6. Categorias
7. Metas
8. Relatórios
9. Configurações

Ações rápidas acessíveis globalmente:
- Nova despesa
- Nova receita
- Nova conta
- Nova compra parcelada

Manter os rótulos visíveis no desktop. No celular, priorizar as ações mais frequentes.

---

## 4. Módulos e funcionalidades

### 4.1 Dashboard

**Objetivo:** apresentar a situação financeira do período sem obrigar o usuário a abrir várias telas.

Indicadores:
- Receitas recebidas no mês.
- Receitas previstas.
- Despesas pagas.
- Despesas pendentes.
- Saldo atual das contas.
- Saldo projetado ao final do mês.

Seções:
- Gráfico de receitas versus despesas.
- Evolução do saldo.
- Despesas por categoria.
- Próximos vencimentos.
- Compromissos recorrentes e parcelas.
- Alertas objetivos.
- Atalhos de cadastro.

O dashboard não deve misturar saldo atual com saldo projetado. Cada indicador deve ter descrição ou tooltip explicando o cálculo.

### 4.2 Contas e compromissos

Tipos: contas fixas, variáveis recorrentes, pontuais, assinaturas, mensalidades, financiamentos e outros compromissos.

Campos:
- Nome e descrição opcional.
- Categoria.
- Valor.
- Vencimento.
- Frequência: única, semanal, mensal, anual ou personalizada.
- Data inicial e data final opcional.
- Forma de pagamento e conta utilizada.
- Observações.

Status: pendente, pago, atrasado ou cancelado.

Ao marcar como paga, registrar a data efetiva e a movimentação correspondente. Alterar uma regra recorrente deve afetar somente compromissos futuros ainda não pagos, mediante confirmação. Preservar o histórico.

### 4.3 Transações

Tipos: receita, despesa e transferência entre contas.

Campos essenciais:
- Tipo.
- Descrição.
- Valor.
- Categoria.
- Data da movimentação.
- Conta ou forma de pagamento.

Campos complementares:
- Data de competência.
- Data de pagamento/recebimento.
- Observações.
- Referência a conta, fatura ou parcelamento.

Permitir busca, filtros por período, categoria e tipo, ordenação e edição. O cadastro rápido deve exibir primeiro os campos essenciais e deixar os demais em “Mais detalhes”.

### 4.4 Parcelamentos

Cadastro:
- Descrição da compra.
- Valor total.
- Quantidade de parcelas.
- Valor e regra de distribuição.
- Data da primeira parcela.
- Categoria.
- Cartão ou forma de pagamento.

Cada parcela deve possuir número, valor, vencimento, status, data de pagamento e vínculo com o plano original.

Exibir:
- Parcelamentos ativos e encerrados.
- Total ainda comprometido.
- Parcelas do mês.
- Compromissos dos próximos meses.
- Progresso de quitação.

A soma das parcelas deve corresponder ao total. Ajustar diferenças de centavos na última parcela. Não duplicar parcelas nem apagar pagamentos silenciosamente. Permitir quitação antecipada com registro do evento.

### 4.5 Cartões de crédito

Cadastro:
- Apelido do cartão e instituição.
- Limite total.
- Dia de fechamento.
- Dia de vencimento.
- Cor identificadora opcional.
- Status.

Não armazenar número completo, CVV ou senha.

Funcionalidades:
- Limite utilizado e disponível.
- Fatura atual e futuras.
- Compras por fatura.
- Histórico de faturas.
- Vencimentos e pagamento.

**Regra crítica:** a compra no cartão representa despesa de consumo. O pagamento da fatura representa saída de caixa e liquidação do compromisso. Não contar os dois eventos como duas despesas nos relatórios de consumo. Separar visão de consumo e fluxo de caixa.

### 4.6 Categorias

Categorias iniciais de despesas:
- Moradia
- Alimentação
- Transporte
- Veículo
- Educação
- Saúde
- Lazer
- Assinaturas
- Compras
- Serviços
- Financiamentos
- Outros

Categorias iniciais de receitas:
- Salário
- Renda extra
- Reembolso
- Investimentos
- Outros

Permitir criar, editar, definir cor e ícone, consultar histórico e arquivar. Não excluir definitivamente categorias já utilizadas.

### 4.7 Metas financeiras

Exemplos: reserva de emergência, imóvel, veículo, viagem e economia geral.

Campos:
- Nome.
- Valor desejado.
- Valor acumulado.
- Data-alvo.
- Prioridade e descrição.

Permitir contribuições com histórico, progresso percentual e cálculo de quanto guardar por mês. Uma meta não aumenta o saldo bancário por si só: só contabilizar dinheiro guardado quando houver movimentação real vinculada.

### 4.8 Relatórios

Relatórios:
- Resumo mensal.
- Receitas e despesas por período.
- Despesas por categoria.
- Evolução do saldo.
- Compromissos futuros.
- Parcelamentos ativos.
- Gastos por cartão.
- Comparação entre meses.
- Percentual da renda comprometida.

Filtros: mês, trimestre, semestre, ano e período personalizado. Exportação em CSV e PDF.

### 4.9 Configurações

Perfil, tema, moeda, formato de data, fuso horário, contas financeiras, categorias, segurança, exportação e backup.

---

## 5. Planejamento e projeção financeira

Este é um dos recursos centrais do NEXO.

### 5.1 Visão mensal

Apresentar:
- Saldo inicial.
- Receitas previstas e recebidas.
- Despesas previstas e pagas.
- Contas pendentes.
- Parcelamentos e faturas.
- Saldo projetado.

### 5.2 Cálculo da projeção

**Saldo projetado = saldo inicial + entradas previstas − saídas previstas.**

Distinguir valores confirmados de estimativas. Receitas variáveis não devem ser tratadas como garantidas. A tela deve explicar quais lançamentos compõem a projeção.

### 5.3 Horizonte futuro

Permitir visualizar 3, 6, 12 e 24 meses, com receitas recorrentes, despesas, parcelas e compromissos programados.

### 5.4 Simulador de compras

O usuário informa valor, número de parcelas, valor mensal e primeira data. O sistema compara o cenário atual com o cenário após a compra, mostrando o impacto mensal e os meses afetados. Simulação não cria movimentações reais até confirmação.

---

## 6. Regras de negócio e integridade

### 6.1 Conceitos que não podem ser confundidos
- Saldo disponível: soma dos saldos efetivos das contas financeiras.
- Saldo atual: posição financeira na data de referência.
- Receita/despesa realizada: evento efetivamente recebido ou pago, conforme a regra definida.
- Previsto: lançamento esperado, ainda não realizado.
- Compromisso futuro: obrigação ainda não liquidada.
- Saldo projetado: saldo estimado após considerar entradas e saídas futuras.
- Transferência: movimentação entre contas próprias, não receita nem despesa de consumo.

### 6.2 Datas

Diferenciar data de competência, data de vencimento, data de compra e data de pagamento. Configurar `America/Cuiaba` como fuso horário padrão. Usar datas locais de forma consistente.

### 6.3 Valores

- Usar `Decimal` no backend e `DecimalField` no banco.
- Nunca usar `float` para cálculos monetários.
- Definir precisão e arredondamento.
- Formatar no frontend com padrão `pt-BR`.

### 6.4 Recorrência e duplicidade

A geração de compromissos recorrentes deve ser idempotente: executar novamente não pode gerar duplicatas. Usar identificadores de origem e restrições de unicidade quando aplicável.

### 6.5 Histórico

Pagamentos e recebimentos confirmados não devem desaparecer silenciosamente. Alterações relevantes devem gerar histórico ou estorno auditável. Operações que alteram múltiplos registros devem usar transações atômicas no banco.

---

## 7. Arquitetura técnica

### 7.1 Stack recomendada

**Backend**
- Python
- Django
- Django REST Framework
- PostgreSQL

**Frontend**
- React
- TypeScript em modo strict
- Vite
- Tailwind CSS
- shadcn/ui
- Lucide React
- Recharts

**Infraestrutura**
- Git e GitHub
- Docker para ambiente reproduzível
- VPS ou hospedagem compatível com Django/PostgreSQL
- HTTPS
- Backups automatizados

### 7.2 Arquitetura lógica

`React → API REST versionada → Django → PostgreSQL`

O frontend cuida da apresentação e interação. O backend aplica regras, validações, permissões e cálculos definitivos. O banco mantém os registros e relacionamentos. O frontend nunca será a fonte oficial dos cálculos financeiros.

### 7.3 Estrutura sugerida do backend

```text
backend/
├── config/
│   ├── settings/
│   │   ├── base.py
│   │   ├── development.py
│   │   └── production.py
│   ├── urls.py
│   ├── asgi.py
│   └── wsgi.py
├── apps/
│   ├── accounts/
│   ├── transactions/
│   ├── categories/
│   ├── recurring/
│   ├── installments/
│   ├── credit_cards/
│   ├── goals/
│   ├── reports/
│   ├── dashboard/
│   └── audit/
├── common/
│   ├── permissions/
│   ├── exceptions/
│   └── utilities/
├── tests/
├── manage.py
└── requirements/
```

Cada app deve separar models, serializers, services, views, urls e testes conforme a necessidade. Regras complexas ficam em services, não concentradas nas views.

### 7.4 Estrutura sugerida do frontend

```text
frontend/
└── src/
    ├── app/
    │   ├── routes/
    │   ├── providers/
    │   └── layouts/
    ├── components/
    │   ├── ui/
    │   ├── charts/
    │   ├── forms/
    │   └── financial/
    ├── features/
    │   ├── dashboard/
    │   ├── accounts/
    │   ├── transactions/
    │   ├── installments/
    │   ├── credit-cards/
    │   ├── categories/
    │   ├── goals/
    │   ├── reports/
    │   └── settings/
    ├── hooks/
    ├── services/
    ├── lib/
    ├── types/
    ├── utils/
    └── styles/
```

Diretrizes: componentes pequenos, tipagem forte, serviços de API separados das telas, validação de formulários, tratamento padronizado de erros e evitar arquivos gigantes ou lógica duplicada.

---

## 8. Modelagem de dados inicial

| Entidade | Responsabilidade |
|---|---|
| User | Proprietário dos dados |
| FinancialAccount | Conta bancária, carteira ou reserva |
| Transaction | Receita, despesa ou transferência |
| Category | Classificação |
| RecurringRule | Regra de recorrência |
| FinancialObligation | Compromisso e vencimento |
| InstallmentPlan | Compra parcelada |
| Installment | Parcela individual |
| CreditCard | Cartão |
| CreditCardInvoice | Fatura |
| CreditCardPurchase | Compra no cartão |
| Goal | Meta financeira |
| GoalContribution | Contribuição |
| AuditLog | Histórico de alterações |

Todo registro financeiro deve estar associado ao proprietário. Definir chaves estrangeiras, índices, unicidade e validações de domínio. O modelo deve impedir duplicação de parcelas, faturas e pagamentos.

---

## 9. API REST

Prefixo: `/api/v1/`

Endpoints iniciais sugeridos:

| Método | Endpoint | Finalidade |
|---|---|---|
| GET | `/dashboard/summary/` | Resumo |
| GET | `/dashboard/projection/` | Projeção |
| GET/POST | `/accounts/` | Listar/criar contas |
| GET/POST | `/transactions/` | Listar/criar movimentações |
| PATCH | `/transactions/{id}/` | Editar movimentação |
| GET | `/installments/` | Consultar parcelas |
| POST | `/installments/plans/` | Criar parcelamento |
| GET | `/credit-cards/` | Consultar cartões |
| GET | `/credit-cards/invoices/` | Consultar faturas |
| GET | `/reports/summary/` | Relatórios |
| GET/POST | `/goals/` | Metas |

A API deve ter paginação, filtros, ordenação, validação, respostas padronizadas, tratamento de exceções, autenticação e documentação OpenAPI.

---

## 10. Segurança e privacidade

- Login individual.
- Senhas armazenadas com hash seguro do Django.
- Proteção de sessão e CSRF.
- HTTPS obrigatório em produção.
- Limitação de tentativas de autenticação.
- Permissão verificada em todos os endpoints.
- CORS restrito às origens autorizadas.
- Cookies seguros quando aplicável.
- Segredos em variáveis de ambiente.
- `DEBUG=False` em produção.
- Validação no backend.
- Não registrar valores financeiros sensíveis em logs.
- Não armazenar CVV, senhas bancárias ou número completo de cartão.
- Não expor endpoints ou arquivos de backup publicamente.

### Backup e restauração

Automatizar backups do PostgreSQL, armazenar cópias fora do servidor principal, definir retenção e proteger os arquivos. Documentar e testar a restauração periodicamente. Backup só é confiável depois de um teste de restauração.

---

## 11. UX e usabilidade

### Cadastro rápido

Para uma despesa simples, priorizar descrição, valor, categoria e data. Campos adicionais ficam em seção expansível.

### Feedback

Após cada operação:
- Confirmar sucesso.
- Atualizar indicadores afetados.
- Mostrar erros junto aos campos.
- Evitar envio duplicado.
- Preservar dados digitados em caso de erro.

### Estados obrigatórios

Todas as telas devem prever carregamento, estado vazio, erro de conexão, erro de validação, sucesso e cancelamento. Não exibir páginas em branco quando ainda não houver dados.

### Acessibilidade

Contraste adequado, navegação por teclado, rótulos nos campos, foco visível, ícones acompanhados de texto quando necessário e mensagens compreensíveis.

---

## 12. Fluxos de utilização

Os fluxogramas completos estão na pasta `fluxogramas/`.

Fluxos principais:
1. Entrada no sistema e navegação pelo dashboard.
2. Cadastro de despesa.
3. Cadastro de compra parcelada.
4. Pagamento de conta.
5. Projeção financeira e simulação de compra.

---

## 13. Fases de desenvolvimento

### Fase 1 — Fundação
- Repositório e ambientes.
- Django, React, TypeScript e PostgreSQL.
- Configuração segura.
- Autenticação.
- Layout e design system.

**Entrega:** aplicação funcional com login e navegação.

### Fase 2 — Base financeira
- Contas financeiras.
- Categorias.
- Receitas, despesas e transferências.
- Histórico e filtros.
- Validações.

**Entrega:** controle financeiro básico funcional.

### Fase 3 — Contas recorrentes
- Regras recorrentes.
- Compromissos e vencimentos.
- Pagamentos e status.
- Alertas.
- Geração sem duplicidade.

**Entrega:** gerenciamento de contas fixas e variáveis.

### Fase 4 — Parcelamentos e cartões
- Cartões e faturas.
- Compras.
- Parcelamentos e parcelas.
- Quitação e fechamento.
- Prevenção de duplicidade.

**Entrega:** controle detalhado de compromissos futuros.

### Fase 5 — Dashboard e projeções
- Indicadores.
- Gráficos.
- Próximos vencimentos.
- Projeção mensal e anual.
- Simulador de compras.

**Entrega:** visão consolidada e planejamento futuro.

### Fase 6 — Metas e relatórios
- Metas e contribuições.
- Relatórios e filtros.
- Comparações.
- Exportação CSV/PDF.

**Entrega:** análise financeira completa.

### Fase 7 — Qualidade e publicação
- Testes automatizados.
- Testes de segurança e responsividade.
- Testes de integridade financeira.
- Configuração de produção, domínio e HTTPS.
- Backup e monitoramento.

**Entrega:** sistema pronto para uso pessoal.

---

## 14. Testes e critérios de qualidade

### Backend
Testar receitas, despesas, transferências, saldo, recorrência, parcelas, faturas, projeções, arredondamento, datas e permissões.

### Frontend
Testar navegação, formulários, filtros, modais, responsividade, valores, estados vazios e tratamento de erros.

### Integração
1. Cadastrar despesa e conferir dashboard.
2. Criar parcelamento e conferir todos os meses.
3. Pagar parcela e conferir saldo.
4. Cadastrar compra no cartão e conferir fatura.
5. Pagar fatura e garantir que não houve despesa duplicada.
6. Alterar recorrência e preservar histórico.
7. Estornar registro e recalcular indicadores.

Um módulo só estará concluído quando tiver interface, regras de negócio, persistência, integração e testes.

---

## 15. Prioridades

| Prioridade | Funcionalidade |
|---|---|
| P0 | Autenticação e segurança |
| P0 | Contas financeiras |
| P0 | Receitas e despesas |
| P0 | Categorias |
| P0 | Dashboard básico |
| P1 | Contas recorrentes |
| P1 | Parcelamentos |
| P1 | Cartões e faturas |
| P1 | Projeções |
| P2 | Metas |
| P2 | Relatórios avançados |
| P2 | Exportação |
| P2 | Simulador de compras |

P0 é a fundação para o primeiro uso. P1 completa o controle detalhado. P2 amplia o planejamento.

---

## 16. Critérios de conclusão

O NEXO estará pronto quando o usuário conseguir:
- Cadastrar receitas e despesas.
- Organizar contas fixas e variáveis.
- Registrar compras parceladas.
- Controlar cartões e faturas.
- Acompanhar pagamentos.
- Consultar saldo atual e projetado.
- Visualizar os próximos meses.
- Analisar despesas por categoria.
- Criar metas.
- Exportar relatórios.
- Fazer backup e restaurar os dados.

A aplicação deverá ser responsiva, protegida por autenticação e ter cálculos financeiros cobertos por testes.

---

## 17. Diretriz final

Construir primeiro um sistema financeiramente correto, depois uma interface sofisticada e, por fim, recursos avançados de planejamento.

O objetivo não é acumular funcionalidades. É oferecer uma ferramenta que possa ser usada diariamente, com clareza, precisão, segurança e facilidade.

**Experiência ideal:** abrir o sistema → entender a situação financeira → cadastrar movimentações → acompanhar compromissos → visualizar o futuro → tomar decisões melhores.
