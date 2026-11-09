#!/usr/bin/env bash
# Backup do PostgreSQL do NEXO (formato custom, comprimido) com retenção e cópia externa opcional.
#
# Uso:    scripts/backup.sh [pasta=backups] [dias-de-retenção=30]
# Cron:   0 3 * * *  cd /opt/nexo && scripts/backup.sh >> backups/backup.log 2>&1
# Env:    COMPOSE      comando do compose (padrão: produção)
#         RCLONE_DEST  se definido (ex.: "gdrive:nexo-backups"), copia o arquivo para fora do servidor com rclone
set -euo pipefail

COMPOSE=${COMPOSE:-"docker compose -f docker-compose.prod.yml --env-file .env.prod"}
DIR=${1:-backups}
KEEP_DAYS=${2:-30}

umask 077                                   # arquivos legíveis só pelo dono
mkdir -p "$DIR"
FILE="$DIR/nexo-$(date +%Y%m%d-%H%M%S).dump"

# Grava em arquivo temporário e só renomeia se o pg_dump terminar bem (nunca deixa backup truncado).
$COMPOSE exec -T db pg_dump -U nexo -d nexo -Fc --no-owner > "$FILE.tmp"
[ -s "$FILE.tmp" ] || { echo "ERRO: backup vazio" >&2; rm -f "$FILE.tmp"; exit 1; }
mv "$FILE.tmp" "$FILE"

# Retenção local
find "$DIR" -name 'nexo-*.dump' -mtime +"$KEEP_DAYS" -delete

# Cópia fora do servidor principal (plano §10)
if [ -n "${RCLONE_DEST:-}" ]; then
  rclone copy "$FILE" "$RCLONE_DEST"
fi

echo "$FILE"
