#!/bin/sh
# Rotina de backup automático do PostgreSQL para o Nexo Gestão Financeira.
# Roda a cada 3 dias (259200 segundos) e guarda os backups por 7 dias.

set -eu

DESTINO=/backups
RETENCAO_DIAS=7
TEMPO_ENTRE_COPIAS=259200
TEMPO_ATE_TENTAR_DE_NOVO=3600

registrar() {
    echo "[backup $(date '+%Y-%m-%d %H:%M:%S')] $*"
}

fazer_copia() {
    dia=$(date +%Y-%m-%d_%H%M%S)
    final="$DESTINO/nexo-$dia.sql.gz"
    temporario="$DESTINO/.nexo-$dia.tmp"

    registrar "Iniciando backup do banco de dados nexo..."
    if ! pg_dump -h db -U nexo nexo | gzip > "$temporario"; then
        registrar "ERRO: pg_dump falhou ao exportar os dados."
        rm -f "$temporario"
        return 1
    fi

    # Valida integridade do dump
    if ! gunzip -c "$temporario" | tail -n 5 | grep "PostgreSQL database dump complete" > /dev/null; then
        registrar "ERRO: cópia do banco incompleta ou corrompida."
        rm -f "$temporario"
        return 1
    fi

    mv "$temporario" "$final"
    registrar "Backup concluído com sucesso: $(basename "$final") ($(du -k "$final" | cut -f1) KB)"

    # Limpeza de backups com mais de 7 dias
    registrar "Removendo backups locais com mais de $RETENCAO_DIAS dias..."
    find "$DESTINO" -name 'nexo-*.sql.gz' -mtime +"$RETENCAO_DIAS" -delete
    registrar "Limpeza de histórico concluída."
}

# Aguarda o banco subir completamente no boot
sleep 60

while true; do
    if fazer_copia; then
        registrar "Próximo backup agendado para daqui a 3 dias ($TEMPO_ENTRE_COPIAS s)."
        sleep "$TEMPO_ENTRE_COPIAS"
    else
        registrar "Tentativa falhou. Nova tentativa em 1 hora ($TEMPO_ATE_TENTAR_DE_NOVO s)."
        sleep "$TEMPO_ATE_TENTAR_DE_NOVO"
    fi
done

