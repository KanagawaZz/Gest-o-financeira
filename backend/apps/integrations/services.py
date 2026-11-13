"""Serviço de sincronização Open Finance (Meu Pluggy) com o livro-caixa do NEXO."""
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any

from django.db import transaction as db_transaction
from django.utils import timezone

from apps.accounts.models import FinancialAccount
from apps.accounts.services import balances_for_owner
from apps.audit.services import record
from apps.categories.models import Category
from apps.categories.services import seed_default_categories
from apps.credit_cards.models import CreditCard, CreditCardInvoice
from apps.credit_cards.services import invoice_for
from apps.transactions.models import Transaction
from common.crypto import CredentialDecryptionError
from common.utilities.money import ZERO, to_money

from .categorizer import TransactionCategorizer, normalize_text
from .models import PluggyCredential
from .pluggy_client import PluggyClient, PluggyError

FIRST_SYNC_LOOKBACK_DAYS = 90
INCREMENTAL_SYNC_OVERLAP_DAYS = 5


def _parse_iso_date(raw_value: Any) -> date:
    if isinstance(raw_value, date) and not isinstance(raw_value, datetime):
        return raw_value
    text = str(raw_value or "").strip()
    if len(text) >= 10:
        try:
            return date.fromisoformat(text[:10])
        except ValueError:
            pass
    return timezone.localdate()


def _extract_day(raw_value: Any, default_day: int) -> int:
    if not raw_value:
        return default_day
    if isinstance(raw_value, int) and 1 <= raw_value <= 31:
        return raw_value
    parsed = _parse_iso_date(raw_value)
    return parsed.day


def _unique_account_name(user, base_name: str) -> str:
    clean = (base_name or "Conta Open Finance").strip()[:50]
    candidate = clean
    suffix = 2
    existing = set(
        FinancialAccount.objects.filter(owner=user).values_list("name", flat=True)
    )
    while candidate in existing:
        candidate = f"{clean[:44]} ({suffix})"
        suffix += 1
    return candidate


def _unique_card_name(user, base_name: str) -> str:
    clean = (base_name or "Cartão Open Finance").strip()[:50]
    candidate = clean
    suffix = 2
    existing = set(
        CreditCard.objects.filter(owner=user).values_list("name", flat=True)
    )
    while candidate in existing:
        candidate = f"{clean[:44]} ({suffix})"
        suffix += 1
    return candidate


def _resolve_or_create_bank_account(user, acc_data: dict[str, Any]) -> FinancialAccount:
    pluggy_id = str(acc_data.get("id") or "").strip()
    ext_key = f"pluggy:{pluggy_id}"

    account = FinancialAccount.objects.filter(owner=user, external_id=ext_key).first()
    if account:
        return account

    raw_name = str(acc_data.get("name") or acc_data.get("marketingName") or "Conta Bancária").strip()
    subtype = str(acc_data.get("subtype") or "").upper()
    acc_type = (
        FinancialAccount.Type.SAVINGS
        if "SAVINGS" in subtype
        else FinancialAccount.Type.CHECKING
    )

    # Se já existir conta com o mesmo nome sem vínculo externo, vincula
    by_name = FinancialAccount.objects.filter(
        owner=user, name__iexact=raw_name[:60], external_id__isnull=True
    ).first()
    if by_name:
        by_name.external_id = ext_key
        by_name.save(update_fields=["external_id"])
        return by_name

    return FinancialAccount.objects.create(
        owner=user,
        name=_unique_account_name(user, raw_name),
        type=acc_type,
        initial_balance=ZERO,
        color="#5B8FB9",
        external_id=ext_key,
    )


def _resolve_or_create_credit_card(user, acc_data: dict[str, Any]) -> CreditCard:
    pluggy_id = str(acc_data.get("id") or "").strip()
    ext_key = f"pluggy:{pluggy_id}"

    card = CreditCard.objects.filter(owner=user, external_id=ext_key).first()
    if card:
        return card

    raw_name = str(acc_data.get("name") or acc_data.get("marketingName") or "Cartão de Crédito").strip()
    credit_data = acc_data.get("creditData") or {}
    brand = str(credit_data.get("brand") or "").strip()
    raw_limit = credit_data.get("creditLimit") or credit_data.get("availableCreditLimit") or 5000
    try:
        credit_limit = max(to_money(Decimal(str(raw_limit))), Decimal("100.00"))
    except Exception:  # noqa: BLE001
        credit_limit = Decimal("5000.00")

    closing_day = _extract_day(credit_data.get("balanceCloseDate"), 10)
    due_day = _extract_day(credit_data.get("balanceDueDate"), 17)

    by_name = CreditCard.objects.filter(
        owner=user, name__iexact=raw_name[:60], external_id__isnull=True
    ).first()
    if by_name:
        by_name.external_id = ext_key
        by_name.save(update_fields=["external_id"])
        return by_name

    return CreditCard.objects.create(
        owner=user,
        name=_unique_card_name(user, raw_name),
        institution=brand[:60],
        credit_limit=credit_limit,
        closing_day=closing_day,
        due_day=due_day,
        color="#7C6D9B",
        external_id=ext_key,
    )


def _is_card_bill_payment_credit(tx_data: dict[str, Any], raw_amount: Decimal) -> bool:
    """Identifica créditos de pagamento da própria fatura no extrato do cartão para não duplicar."""
    tx_type = str(tx_data.get("type") or "").upper()
    desc = normalize_text(str(tx_data.get("description") or ""))
    if raw_amount < 0 or tx_type == "CREDIT":
        if any(term in desc for term in ("pagamento", "pagto", "fatura", "debito automatico")):
            return True
        if raw_amount < 0:
            return True
    return False


def _reconcile_bank_account_balance(account: FinancialAccount, target_balance_raw: Any) -> None:
    """Ajusta `initial_balance` para que o saldo derivado no NEXO bata exatamente com o saldo real do banco."""
    if target_balance_raw is None:
        return
    try:
        target_balance = to_money(Decimal(str(target_balance_raw)))
    except Exception:  # noqa: BLE001
        return

    current_derived = balances_for_owner(account.owner).get(account.pk, ZERO)
    diff = to_money(target_balance - current_derived)
    if diff != ZERO:
        account.initial_balance = to_money(account.initial_balance + diff)
        account.save(update_fields=["initial_balance"])


def sync_user_pluggy(credential: PluggyCredential, *, client: PluggyClient | None = None) -> dict[str, int]:
    """Executa a sincronização completa de um usuário com a Pluggy de forma atômica e idempotente."""
    user = credential.owner
    seed_default_categories(user)

    PluggyCredential.objects.filter(pk=credential.pk).update(
        last_sync_status=PluggyCredential.SyncStatus.RUNNING,
        last_sync_message="Sincronizando com a Pluggy...",
    )

    try:
        client_id, client_secret, item_ids = credential.get_decrypted_secrets()
        api = client or PluggyClient(client_id, client_secret)
        api.authenticate()

        today = timezone.localdate()
        if credential.last_sync_at:
            date_from = credential.last_sync_at.date() - timedelta(days=INCREMENTAL_SYNC_OVERLAP_DAYS)
        else:
            date_from = today - timedelta(days=FIRST_SYNC_LOOKBACK_DAYS)

        categorizer = TransactionCategorizer(user)
        accounts_synced = 0
        cards_synced = 0
        created_count = 0
        skipped_count = 0

        existing_ext_ids: set[str] = set(
            Transaction.objects.filter(owner=user, external_id__isnull=False).values_list("external_id", flat=True)
        )

        for item_id in item_ids:
            pluggy_accounts = api.list_accounts(item_id)
            for acc_data in pluggy_accounts:
                pluggy_acc_id = str(acc_data.get("id") or "").strip()
                if not pluggy_acc_id:
                    continue

                acc_type = str(acc_data.get("type") or "BANK").upper()
                tx_list = api.list_transactions(pluggy_acc_id, date_from=date_from, date_to=today)

                with db_transaction.atomic():
                    if acc_type == "CREDIT":
                        card = _resolve_or_create_credit_card(user, acc_data)
                        cards_synced += 1
                        for tx_data in tx_list:
                            tx_id = str(tx_data.get("id") or "").strip()
                            if not tx_id:
                                continue
                            ext_id = f"pluggy:{tx_id}"
                            if ext_id in existing_ext_ids:
                                skipped_count += 1
                                continue

                            try:
                                raw_amount = Decimal(str(tx_data.get("amount") or "0"))
                            except Exception:  # noqa: BLE001
                                continue

                            if _is_card_bill_payment_credit(tx_data, raw_amount):
                                skipped_count += 1
                                continue

                            abs_amount = to_money(abs(raw_amount))
                            if abs_amount <= ZERO:
                                continue

                            tx_date = _parse_iso_date(tx_data.get("date"))
                            desc = str(
                                tx_data.get("description")
                                or tx_data.get("descriptionRaw")
                                or "Compra no Cartão"
                            ).strip()[:120]
                            category = categorizer.guess(
                                kind=Category.Kind.EXPENSE,
                                description=desc,
                                pluggy_category=tx_data.get("category"),
                            )
                            invoice = invoice_for(card, tx_date)
                            tx_status = (
                                Transaction.Status.REALIZED
                                if invoice.status == CreditCardInvoice.Status.PAID
                                else Transaction.Status.PENDING
                            )
                            Transaction.objects.create(
                                owner=user,
                                type=Transaction.Type.EXPENSE,
                                description=desc,
                                amount=abs_amount,
                                category=category,
                                credit_card=card,
                                invoice=invoice,
                                date=tx_date,
                                settled_date=invoice.paid_at if tx_status == Transaction.Status.REALIZED else None,
                                status=tx_status,
                                external_id=ext_id,
                                notes="Importado automaticamente via Open Finance (Meu Pluggy).",
                            )
                            existing_ext_ids.add(ext_id)
                            created_count += 1
                    else:
                        fin_account = _resolve_or_create_bank_account(user, acc_data)
                        accounts_synced += 1
                        for tx_data in tx_list:
                            tx_id = str(tx_data.get("id") or "").strip()
                            if not tx_id:
                                continue
                            ext_id = f"pluggy:{tx_id}"
                            if ext_id in existing_ext_ids:
                                skipped_count += 1
                                continue

                            try:
                                raw_amount = Decimal(str(tx_data.get("amount") or "0"))
                            except Exception:  # noqa: BLE001
                                continue

                            abs_amount = to_money(abs(raw_amount))
                            if abs_amount <= ZERO:
                                continue

                            pluggy_tx_type = str(tx_data.get("type") or "").upper()
                            if pluggy_tx_type == "DEBIT" or (not pluggy_tx_type and raw_amount < 0):
                                nexo_type = Transaction.Type.EXPENSE
                                cat_kind = Category.Kind.EXPENSE
                            else:
                                nexo_type = Transaction.Type.INCOME
                                cat_kind = Category.Kind.INCOME

                            tx_date = _parse_iso_date(tx_data.get("date"))
                            desc = str(
                                tx_data.get("description")
                                or tx_data.get("descriptionRaw")
                                or "Movimentação Bancária"
                            ).strip()[:120]
                            category = categorizer.guess(
                                kind=cat_kind,
                                description=desc,
                                pluggy_category=tx_data.get("category"),
                            )
                            pluggy_status = str(tx_data.get("status") or "POSTED").upper()
                            nexo_status = (
                                Transaction.Status.PENDING
                                if pluggy_status == "PENDING"
                                else Transaction.Status.REALIZED
                            )
                            Transaction.objects.create(
                                owner=user,
                                type=nexo_type,
                                description=desc,
                                amount=abs_amount,
                                category=category,
                                account=fin_account,
                                date=tx_date,
                                settled_date=tx_date if nexo_status == Transaction.Status.REALIZED else None,
                                status=nexo_status,
                                external_id=ext_id,
                                notes="Importado automaticamente via Open Finance (Meu Pluggy).",
                            )
                            existing_ext_ids.add(ext_id)
                            created_count += 1

                        _reconcile_bank_account_balance(fin_account, acc_data.get("balance"))

        now = timezone.now()
        summary_msg = (
            f"Sincronizado: {created_count} novo(s) lançamento(s) "
            f"em {accounts_synced} conta(s) e {cards_synced} cartão(ões)."
        )
        credential.last_sync_at = now
        credential.last_sync_status = PluggyCredential.SyncStatus.SUCCESS
        credential.last_sync_message = summary_msg[:240]
        credential.last_synced_count = created_count
        credential.save(
            update_fields=[
                "last_sync_at",
                "last_sync_status",
                "last_sync_message",
                "last_synced_count",
                "updated_at",
            ]
        )
        record(
            user,
            "pluggy.sync",
            credential,
            {
                "created_transactions": created_count,
                "skipped_transactions": skipped_count,
                "accounts": accounts_synced,
                "cards": cards_synced,
            },
        )
        return {
            "created_transactions": created_count,
            "skipped_transactions": skipped_count,
            "accounts_synced": accounts_synced,
            "cards_synced": cards_synced,
        }

    except (PluggyError, CredentialDecryptionError, ValueError) as exc:
        err_msg = str(exc)[:240]
        credential.last_sync_status = PluggyCredential.SyncStatus.ERROR
        credential.last_sync_message = err_msg
        credential.save(update_fields=["last_sync_status", "last_sync_message", "updated_at"])
        raise
    except Exception as exc:
        credential.last_sync_status = PluggyCredential.SyncStatus.ERROR
        credential.last_sync_message = "Erro interno durante a sincronização com o Open Finance."
        credential.save(update_fields=["last_sync_status", "last_sync_message", "updated_at"])
        raise PluggyError("Erro inesperado ao processar os dados bancários.") from exc


def purge_user_pluggy_data(user) -> dict[str, int]:
    """Remove contas, cartões, faturas e lançamentos importados via Pluggy (`external_id` `pluggy:*`)."""
    from django.db.models import Q
    from apps.installments.models import InstallmentPlan
    from apps.recurring.models import RecurringRule

    with db_transaction.atomic():
        pluggy_accounts = list(
            FinancialAccount.objects.filter(owner=user, external_id__startswith="pluggy:")
        )
        pluggy_cards = list(
            CreditCard.objects.filter(owner=user, external_id__startswith="pluggy:")
        )

        tx_qs = Transaction.objects.filter(owner=user).filter(
            Q(external_id__startswith="pluggy:")
            | Q(account__in=pluggy_accounts)
            | Q(destination_account__in=pluggy_accounts)
            | Q(credit_card__in=pluggy_cards)
            | Q(invoice__card__in=pluggy_cards)
        )
        deleted_tx, _ = tx_qs.delete()

        if pluggy_accounts:
            RecurringRule.objects.filter(owner=user, account__in=pluggy_accounts).delete()
            InstallmentPlan.objects.filter(owner=user, account__in=pluggy_accounts).delete()
        if pluggy_cards:
            InstallmentPlan.objects.filter(owner=user, credit_card__in=pluggy_cards).delete()
            CreditCardInvoice.objects.filter(owner=user, card__in=pluggy_cards).delete()

        deleted_cards = len(pluggy_cards)
        deleted_accounts = len(pluggy_accounts)

        for card in pluggy_cards:
            card.delete()
        for acc in pluggy_accounts:
            acc.delete()

    return {
        "deleted_transactions": deleted_tx,
        "deleted_accounts": deleted_accounts,
        "deleted_cards": deleted_cards,
    }
