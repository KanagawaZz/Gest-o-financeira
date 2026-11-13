"""Comando de sincronização em background do Open Finance (Meu Pluggy).

Pode ser executado:
- Como job único (Cron / Dokploy Schedule): `python manage.py sync_pluggy`
- Ou em loop contínuo leve: `python manage.py sync_pluggy --loop --interval 21600` (6 em 6 horas)
"""
import time
from contextlib import contextmanager

from django.core.management.base import BaseCommand
from django.db import connection

from apps.integrations.models import PluggyCredential
from apps.integrations.services import sync_user_pluggy

ADVISORY_LOCK_ID = 94827165


@contextmanager
def _pg_advisory_lock():
    """Garante exclusão mútua no PostgreSQL para evitar duas rotinas de sync simultâneas."""
    if connection.vendor != "postgresql":
        yield True
        return
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_try_advisory_lock(%s);", [ADVISORY_LOCK_ID])
        row = cursor.fetchone()
        acquired = bool(row and row[0])
    try:
        yield acquired
    finally:
        if acquired:
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_advisory_unlock(%s);", [ADVISORY_LOCK_ID])


class Command(BaseCommand):
    help = "Sincroniza transações bancárias de todos os usuários com credenciais ativas do Meu Pluggy."

    def add_arguments(self, parser):
        parser.add_argument(
            "--user-id",
            type=int,
            default=None,
            help="Sincroniza apenas um usuário específico pelo ID.",
        )
        parser.add_argument(
            "--loop",
            action="store_true",
            help="Mantém o processo rodando em loop contínuo no intervalo especificado.",
        )
        parser.add_argument(
            "--interval",
            type=int,
            default=21600,
            help="Intervalo em segundos entre execuções no modo --loop (padrão: 21600 = 6h).",
        )

    def _run_once(self, user_id: int | None = None) -> None:
        with _pg_advisory_lock() as acquired:
            if not acquired:
                self.stdout.write(self.style.WARNING("Outra sincronização Pluggy já está em andamento. Ignorando."))
                return

            qs = PluggyCredential.objects.filter(is_active=True).select_related("owner")
            if user_id is not None:
                qs = qs.filter(owner_id=user_id)

            credentials = list(qs)
            if not credentials:
                self.stdout.write("Nenhuma credencial ativa do Meu Pluggy encontrada.")
                return

            ok_count = 0
            fail_count = 0
            for cred in credentials:
                try:
                    result = sync_user_pluggy(cred)
                    ok_count += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"[OK] user_id={cred.owner_id}: +{result['created_transactions']} lançamentos "
                            f"({result['accounts_synced']} contas, {result['cards_synced']} cartões)"
                        )
                    )
                except Exception as exc:  # noqa: BLE001
                    fail_count += 1
                    self.stderr.write(
                        self.style.ERROR(f"[ERRO] user_id={cred.owner_id}: {exc}")
                    )

            self.stdout.write(f"Ciclo finalizado: {ok_count} sucesso(s), {fail_count} falha(s).")

    def handle(self, *args, **options):
        user_id = options.get("user_id")
        loop = options.get("loop", False)
        interval = max(int(options.get("interval") or 21600), 300)

        if not loop:
            self._run_once(user_id=user_id)
            return

        self.stdout.write(f"Worker Pluggy iniciado em modo contínuo (intervalo={interval}s).")
        while True:
            try:
                self._run_once(user_id=user_id)
            except Exception as exc:  # noqa: BLE001
                self.stderr.write(self.style.ERROR(f"Erro no ciclo principal do worker: {exc}"))
            time.sleep(interval)

