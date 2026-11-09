#!/usr/bin/env bash
# Teste de restauração: restaura um backup num banco TEMPORÁRIO e compara a contagem de linhas com o banco real.
# O banco real NUNCA é alterado. Falha (exit 1) se qualquer tabela divergir.
#
# Uso: scripts/restore_test.sh [arquivo.dump]   (sem argumento, usa o backup mais recente em backups/)
set -euo pipefail

COMPOSE=${COMPOSE:-"docker compose -f docker-compose.prod.yml --env-file .env.prod"}
FILE=${1:-$(ls -1t backups/nexo-*.dump 2>/dev/null | head -n1)}
[ -n "${FILE:-}" ] && [ -f "$FILE" ] || { echo "Nenhum backup encontrado." >&2; exit 1; }
TMP_DB="nexo_restore_test"

psql_() { $COMPOSE exec -T db psql -U nexo -v ON_ERROR_STOP=1 -At "$@"; }

echo "Restaurando $FILE em '$TMP_DB'..."
psql_ -d postgres -c "DROP DATABASE IF EXISTS $TMP_DB" >/dev/null
psql_ -d postgres -c "CREATE DATABASE $TMP_DB" >/dev/null
$COMPOSE exec -T db pg_restore -U nexo -d "$TMP_DB" --no-owner --exit-on-error < "$FILE"

TABLES="auth_user accounts_financialaccount categories_category transactions_transaction recurring_recurringrule \
credit_cards_creditcard credit_cards_creditcardinvoice installments_installmentplan goals_goal goals_goalcontribution audit_auditlog"

status=0
printf '%-36s %10s %10s\n' tabela original restaurado
for t in $TABLES; do
  a=$(psql_ -d nexo -c "SELECT count(*) FROM $t")
  b=$(psql_ -d "$TMP_DB" -c "SELECT count(*) FROM $t")
  mark=ok; [ "$a" = "$b" ] || { mark="DIVERGE"; status=1; }
  printf '%-36s %10s %10s  %s\n' "$t" "$a" "$b" "$mark"
done

# Conferência de valores: a soma dos lançamentos precisa ser idêntica, centavo a centavo.
sa=$(psql_ -d nexo -c "SELECT coalesce(sum(amount),0) FROM transactions_transaction")
sb=$(psql_ -d "$TMP_DB" -c "SELECT coalesce(sum(amount),0) FROM transactions_transaction")
[ "$sa" = "$sb" ] && echo "soma dos valores: $sa = $sb  ok" || { echo "soma dos valores DIVERGE: $sa vs $sb"; status=1; }

psql_ -d postgres -c "DROP DATABASE $TMP_DB" >/dev/null
[ $status -eq 0 ] && echo "RESTAURAÇÃO VERIFICADA: o backup é confiável." || echo "FALHA: o backup NÃO reproduz o banco."
exit $status
