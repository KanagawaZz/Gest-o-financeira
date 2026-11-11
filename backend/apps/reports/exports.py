import csv
import io
from datetime import date

from apps.transactions.models import Transaction as T

TYPE_LABEL = {"income": "Receita", "expense": "Despesa", "transfer": "Transferência", "card_payment": "Pagamento de fatura"}
STATUS_LABEL = {"pending": "Pendente", "realized": "Realizada", "voided": "Estornada", "cancelled": "Cancelada"}


def csv_safe(value) -> str:
    """Neutraliza injeção de fórmula em planilhas: texto iniciado por = + - @ vira texto literal."""
    s = "" if value is None else str(value)
    return "'" + s if s[:1] in ("=", "+", "-", "@", "\t", "\r") else s


def money_br(value) -> str:
    return f"{value:.2f}".replace(".", ",")


def transactions_csv(owner, d_from: date, d_to: date) -> bytes:
    """CSV para Excel pt-BR: separador ';', decimal ',' e BOM UTF-8 (acentos corretos)."""
    out = io.StringIO()
    w = csv.writer(out, delimiter=";", lineterminator="\r\n")
    w.writerow(["Data", "Tipo", "Descrição", "Categoria", "Conta/Cartão", "Valor", "Situação", "Data efetiva"])
    qs = (
        T.objects.filter(owner=owner, date__range=(d_from, d_to)).exclude(status=T.Status.CANCELLED)
        .select_related("category", "account", "destination_account", "credit_card").order_by("date", "id")
    )  # fmt: skip
    for t in qs:
        where = t.credit_card.name if t.credit_card_id else (f"{t.account.name} → {t.destination_account.name}" if t.destination_account_id else (t.account.name if t.account_id else ""))
        w.writerow([
            t.date.strftime("%d/%m/%Y"), TYPE_LABEL[t.type], csv_safe(t.description), csv_safe(t.category.name if t.category_id else ""),
            csv_safe(where), money_br(t.amount), STATUS_LABEL[t.status], t.settled_date.strftime("%d/%m/%Y") if t.settled_date else "",
        ])  # fmt: skip
    return b"\xef\xbb\xbf" + out.getvalue().encode("utf-8")


def brl(v) -> str:
    n = float(v)
    return "R$ " + f"{n:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def report_pdf(report: dict, user_label: str) -> bytes:
    # Import tardio: o reportlab ocupa ~11 MB de RAM e só é usado aqui. Assim cada worker do
    # Gunicorn só o carrega se alguém exportar um PDF (o primeiro PDF de cada worker leva um pouco mais).
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import cm
    from reportlab.platypus import Flowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=2 * cm, bottomMargin=2 * cm, title="Relatório NEXO")
    st = getSampleStyleSheet()
    p = report["period"]
    d1, d2 = (date.fromisoformat(p["from"]).strftime("%d/%m/%Y"), date.fromisoformat(p["to"]).strftime("%d/%m/%Y"))
    flow: list[Flowable] = [Paragraph("NEXO — Relatório financeiro", st["Title"]), Paragraph(f"Período: {d1} a {d2} · {user_label}", st["Normal"]), Spacer(1, 14)]

    def table(rows, widths=None):
        t = Table(rows, colWidths=widths, repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#263B55")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#9BAABD")), ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F1F4F8")]), ("FONTSIZE", (0, 0), (-1, -1), 9),
        ]))  # fmt: skip
        return t

    t = report["totals"]
    flow += [Paragraph("Resumo do período", st["Heading2"]),
             table([["Receitas", "Despesas", "Resultado", "Renda comprometida"],
                    [brl(t["income"]), brl(t["expense"]), brl(t["result"]), f"{t['committed_percent']}%" if t["committed_percent"] is not None else "—"]]),
             Spacer(1, 12)]  # fmt: skip
    if report["expense_by_category"]:
        flow += [Paragraph("Despesas por categoria", st["Heading2"]),
                 table([["Categoria", "Valor", "%"]] + [[c["name"], brl(c["amount"]), f"{c['percent']}%"] for c in report["expense_by_category"]]), Spacer(1, 12)]  # fmt: skip
    if report["monthly"]:
        flow += [Paragraph("Evolução mensal", st["Heading2"]),
                 table([["Mês", "Receitas", "Despesas", "Resultado"]] + [[m["month"], brl(m["income"]), brl(m["expense"]), brl(m["result"])] for m in report["monthly"]]), Spacer(1, 12)]  # fmt: skip
    if report["by_card"]:
        flow += [Paragraph("Gastos por cartão", st["Heading2"]), table([["Cartão", "Compras", "Valor"]] + [[c["card"], c["purchases"], brl(c["amount"])] for c in report["by_card"]]), Spacer(1, 12)]  # fmt: skip
    if report["active_installments"]:
        flow += [Paragraph("Parcelamentos ativos", st["Heading2"]),
                 table([["Compra", "Parcelas restantes", "Valor restante"]] + [[a["description"], f"{a['remaining_count']} de {a['count']}", brl(a["remaining_amount"])] for a in report["active_installments"]])]  # fmt: skip
    doc.build(flow)
    return buf.getvalue()
