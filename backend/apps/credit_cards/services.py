from datetime import date
from decimal import Decimal

from django.db import transaction as db_transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError

from apps.audit.services import record
from apps.transactions.models import Transaction as T
from common.utilities.dates import clamp_day
from common.utilities.money import ZERO, to_money

from .models import CreditCard, CreditCardInvoice


class Conflict(APIException):
    status_code = 409
    default_code = "conflict"
    default_detail = "A operação não é permitida no estado atual do registro."


def cycle_for(card: CreditCard, purchase_date: date) -> tuple[int, int, date, date]:
    """(ano, mês de fechamento, data de fechamento, data de vencimento) da fatura que recebe a compra.

    Compra até o dia de fechamento (inclusive) entra na fatura que fecha neste mês; depois, na seguinte.
    O vencimento cai no mesmo mês do fechamento se due_day > closing_day; senão, no mês seguinte.
    """
    y, m = purchase_date.year, purchase_date.month
    if purchase_date > clamp_day(y, m, card.closing_day):
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    closing = clamp_day(y, m, card.closing_day)
    dy, dm = (y, m) if card.due_day > card.closing_day else ((y + 1, 1) if m == 12 else (y, m + 1))
    return y, m, closing, clamp_day(dy, dm, card.due_day)


def invoice_for(card: CreditCard, purchase_date: date) -> CreditCardInvoice:
    y, m, closing, due = cycle_for(card, purchase_date)
    invoice, _ = CreditCardInvoice.objects.get_or_create(
        card=card, year=y, month=m, defaults={"owner": card.owner, "closing_date": closing, "due_date": due}
    )
    return invoice


def invoice_entries(invoice: CreditCardInvoice):
    """Compras que compõem a fatura (exclui canceladas/estornadas e o próprio pagamento)."""
    return invoice.entries.filter(type=T.Type.EXPENSE).exclude(status__in=[T.Status.CANCELLED, T.Status.VOIDED])


def invoice_total(invoice: CreditCardInvoice) -> Decimal:
    return to_money(invoice_entries(invoice).aggregate(t=Sum("amount"))["t"] or ZERO)


def limit_used(card: CreditCard) -> Decimal:
    """Limite comprometido = compras ainda não liquidadas (faturas não pagas), inclusive parcelas futuras."""
    qs = T.objects.filter(credit_card=card, type=T.Type.EXPENSE, status=T.Status.PENDING)
    return to_money(qs.aggregate(t=Sum("amount"))["t"] or ZERO)


@db_transaction.atomic
def add_purchase(card: CreditCard, *, description, amount, category, date, notes="", plan=None, number=None) -> T:
    if card.is_archived:
        raise ValidationError({"credit_card": "Este cartão está arquivado."})
    invoice = invoice_for(card, date)
    if invoice.status == CreditCardInvoice.Status.PAID:
        raise ValidationError({"date": "A fatura correspondente a esta data já foi paga."})
    return T.objects.create(
        owner=card.owner, type=T.Type.EXPENSE, description=description, amount=to_money(amount),
        category=category, credit_card=card, invoice=invoice, date=date, status=T.Status.PENDING,
        notes=notes, installment_plan=plan, installment_number=number,
    )  # fmt: skip


@db_transaction.atomic
def pay_invoice(invoice: CreditCardInvoice, account, paid_date: date) -> T:
    """Paga a fatura: saída de caixa (card_payment) + liquida as compras. Não gera nova despesa de consumo."""
    invoice = CreditCardInvoice.objects.select_for_update().get(pk=invoice.pk)
    if invoice.status == CreditCardInvoice.Status.PAID:
        raise Conflict("Esta fatura já foi paga.")
    if account.is_archived:
        raise ValidationError({"account": "Esta conta está arquivada."})
    total = invoice_total(invoice)
    if total <= 0:
        raise Conflict("A fatura não tem lançamentos a pagar.")

    payment = T.objects.create(
        owner=invoice.owner, type=T.Type.CARD_PAYMENT, description=f"Fatura {invoice.card.name} {invoice.month:02d}/{invoice.year}",
        amount=total, account=account, invoice=invoice, date=paid_date, settled_date=paid_date, status=T.Status.REALIZED,
    )  # fmt: skip
    invoice_entries(invoice).filter(status=T.Status.PENDING).update(status=T.Status.REALIZED, settled_date=paid_date)
    invoice.status = CreditCardInvoice.Status.PAID
    invoice.paid_at = paid_date
    invoice.save(update_fields=["status", "paid_at"])
    record(invoice.owner, "invoice.paid", invoice, {"amount": str(total), "account": account.pk, "transaction": payment.pk})
    return payment


@db_transaction.atomic
def reopen_invoice(payment: T) -> None:
    """Chamado ao estornar o pagamento: a fatura volta a ficar em aberto e as compras, pendentes."""
    invoice = CreditCardInvoice.objects.select_for_update().get(pk=payment.invoice_id)
    invoice_entries(invoice).filter(status=T.Status.REALIZED).update(status=T.Status.PENDING, settled_date=None)
    invoice.status = CreditCardInvoice.Status.OPEN
    invoice.paid_at = None
    invoice.save(update_fields=["status", "paid_at"])
    record(invoice.owner, "invoice.reopened", invoice, {"transaction": payment.pk})


def current_cycle(card: CreditCard) -> dict:
    """Resumo da fatura do ciclo atual (existindo ou não)."""
    y, m, closing, due = cycle_for(card, timezone.localdate())
    invoice = CreditCardInvoice.objects.filter(card=card, year=y, month=m).first()
    return {
        "id": invoice.pk if invoice else None, "year": y, "month": m, "closing_date": closing, "due_date": due,
        "status": invoice.status if invoice else CreditCardInvoice.Status.OPEN,
        "total": str(invoice_total(invoice)) if invoice else "0.00",
    }  # fmt: skip
