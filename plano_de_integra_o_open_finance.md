# Especificação de Arquitetura: Integração Open Finance via "Meu Pluggy"

## 1. Contexto do Projeto e Restrições
Este é um sistema de gestão financeira voltado para uso pessoal e de um círculo fechado de amigos. O desenvolvedor responsável é pessoa física (CLT, sem CNPJ). 
Devido a essa restrição, não podemos utilizar soluções B2B corporativas de Open Finance (que exigem CNPJ e compliance avançado). 

A solução adotada para automatizar o lançamento de receitas e despesas com dados bancários reais e sem custo será utilizar a plataforma **Meu Pluggy** (versão de uso pessoal da Pluggy).

## 2. Objetivo Principal
Eliminar a necessidade de lançamento manual de transações. O sistema deve ser capaz de se conectar à API da Pluggy usando chaves individuais de cada usuário, buscar transações bancárias periodicamente e inseri-las automaticamente na base de dados do sistema, categorizando-as sempre que possível.

## 3. Arquitetura Proposta (O "Bypass")

Como não usaremos o widget corporativo embutido, a jornada técnica será a seguinte:

### 3.1. Frontend (UX de Configuração)
- O sistema terá uma tela de "Integração Bancária".
- A interface instruirá o usuário a criar uma conta em `meu.pluggy.ai`, conectar seu banco lá e gerar credenciais de API (`Client ID` e `Client Secret`).
- O usuário colará essas duas chaves em um formulário no nosso sistema.

### 3.2. Backend e Banco de Dados (Segurança)
- **Armazenamento:** Precisamos alterar a modelagem do banco de dados (PostgreSQL) para suportar essas chaves vinculadas ao usuário.
- **Segurança (Crítico):** O `Client ID` e o `Client Secret` concedem acesso ao extrato bancário do usuário. O backend **DEVE** criptografar essas chaves (ex: AES-256) antes de salvá-las no banco. Elas só devem ser descriptografadas em memória durante o processo de requisição à API.

### 3.3. Sincronização Assíncrona (Background Job)
- Como não teremos Webhooks automatizados da plataforma, precisaremos de um *Worker* ou *Cron Job*.
- **Rotina:** A cada `X` horas (ex: 6 em 6 horas), o worker varre o banco buscando usuários que possuem credenciais ativas.
- **Execução:** Para cada usuário, o sistema descriptografa as chaves, autentica na API da Pluggy, busca as transações (filtrando desde a última data de sincronização) e realiza o `INSERT` ou `UPDATE` das despesas e receitas.

## 4. Instruções para a IA (Assistente de Código)

Você, como assistente de IA com acesso ao repositório atual, deve ler este documento e executar as seguintes análises:

1. **Análise de Modelagem (Database):** Analise os *schemas/models* atuais do projeto (ex: tabela de usuários, contas e transações). Como devemos alterá-los para armazenar as credenciais da Pluggy e o `transaction_id` externo para evitar duplicidade de lançamentos?
2. **Análise de Segurança:** Baseado na stack atual do projeto (Node, Python, etc.), qual é a melhor biblioteca e estratégia para implementar a criptografia bidirecional das chaves da API no banco de dados?
3. **Análise de Tarefas em Background:** Avaliando a arquitetura atual do projeto, qual a melhor forma de implementar a rotina de sincronização periódica? (ex: node-cron, Celery, BullMQ, etc.).
4. **Motor de Categorização:** Como podemos criar uma função simples e expansível para ler a string da "descrição" da transação que vem da Pluggy e tentar adivinhar a categoria (ex: "UBER" -> "Transporte")?

## 5. Entregável Esperado da IA

Após madurar esta ideia e cruzar com o código existente, gere um **Plano de Implementação em Fases**, detalhando:
- Fase 1: Atualizações de Banco de Dados e Criptografia.
- Fase 2: Criação dos Endpoints e Tela de Configuração (Frontend).
- Fase 3: Desenvolvimento do Serviço de Integração com a API Pluggy.
- Fase 4: Configuração do Worker de Sincronização e Categorização.

Aguardando seu diagnóstico e plano de ação.