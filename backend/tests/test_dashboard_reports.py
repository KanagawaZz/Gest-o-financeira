import csv
import io
from decimal import Decimal

from apps.transactions.models import Transaction as T
from common.utilities.dates import add_months, month_bounds

from .helpers import cat, in_days, iso, make_account, today

SUMMARY = "/api/v1/dashboard/summary/"
PROJECTION = "/api/v1/dashboard/projection/"
SIMULATE = "/api/v1/dashboard/simulate/"


def tx(client, user, acc, kind="expense", amount="100.00", d=None, status="realized", description="Lançamento", **kw):
    body = dict(type=kind, description=description, amount=amount, category=cat(user, kind).pk, account=acc.pk, date=iso(d or today()), status=status)
    body.update(kw)
    r = client.post("/api/v1/transactions/", body, format="json")
    assert r.status_code == 201, r.json()
    return r.json()


def D(v):
    return Decimal(v)


# ---------------------------------------------------------------- resumo
def test_summary_numbers_and_explanations(auth_client, user):
    acc = make_account(user, balance="1000.00")
    first, last = month_bounds(today().year, today().month)
    tx(auth_client, user, acc, "income", "3000.00")
    tx(auth_client, user, acc, "income", "500.00", d=last, status="pending")
    tx(auth_client, user, acc, "expense", "400.00")
    tx(auth_client, user, acc, "expense", "250.00", d=last, status="pending")
    s = auth_client.get(SUMMARY).json()
    i = s["indicators"]
    assert (i["income_received"], i["income_expected"]) == ("3000.00", "500.00")
    assert (i["expense_paid"], i["expense_pending"]) == ("400.00", "250.00")
    assert i["current_balance"] == "3600.00"  # 1000 + 3000 - 400 (pendentes não entram)
    assert i["projected_balance"] == "3850.00"  # 3600 + 500 - 250
    assert i["month_result"] == "2600.00"
    assert i["committed_percent"] == 18.6  # 650 / 3500
    assert set(s["explanations"]) >= {"current_balance", "projected_balance", "income_expected"}  # cada indicador se explica
    assert s["by_category"][0]["name"] == "Alimentação" and s["by_category"][0]["amount"] == "650.00"
    assert len(s["series"]) == 6 and s["series"][-1]["month"] == today().strftime("%Y-%m")


def test_summary_trends_per_indicator(auth_client, user):
    acc = make_account(user, balance="1000.00")
    this_month = today().replace(day=1)
    two_ago, last_month = add_months(this_month, -2), add_months(this_month, -1)
    tx(auth_client, user, acc, "income", "500.00", d=two_ago)
    tx(auth_client, user, acc, "expense", "200.00", d=last_month)
    tx(auth_client, user, acc, "expense", "50.00", d=in_days(0), status="pending")
    s = auth_client.get(SUMMARY).json()
    t = s["trends"]
    assert all(len(v) == 6 for v in t.values())
    assert [x["value"] for x in t["income_received"]][-3:] == ["500.00", "0.00", "0.00"]
    assert [x["value"] for x in t["expense_paid"]][-3:] == ["0.00", "200.00", "0.00"]
    assert t["expense_pending"][-1]["value"] == "50.00"
    # Saldo ao fim de cada mês (o último é hoje); a pendência não entra no saldo atual.
    assert [x["value"] for x in t["current_balance"]][-4:] == ["1000.00", "1500.00", "1300.00", "1300.00"]
    assert t["current_balance"][-1]["value"] == s["indicators"]["current_balance"]
    # Projetado: mês atual primeiro, igual ao indicador.
    assert t["projected_balance"][0] == {"month": this_month.strftime("%Y-%m"), "value": "1250.00"}
    assert t["projected_balance"][0]["value"] == s["indicators"]["projected_balance"]


def test_current_and_projected_balance_are_never_mixed(auth_client, user):
    acc = make_account(user, balance="100.00")
    tx(auth_client, user, acc, "expense", "30.00", d=in_days(0), status="pending")
    i = auth_client.get(SUMMARY).json()["indicators"]
    assert i["current_balance"] == "100.00" and i["projected_balance"] == "70.00"


def test_card_consumption_counts_once_and_cash_leaves_at_invoice(auth_client, user):
    acc = make_account(user, balance="2000.00")
    card = auth_client.post("/api/v1/credit-cards/", dict(name="Visa", credit_limit="5000", closing_day=10, due_day=20), format="json").json()["id"]
    auth_client.post(f"/api/v1/credit-cards/{card}/purchases/", dict(description="TV", amount="600.00", category=cat(user).pk, date=iso(today())), format="json")

    proj = auth_client.get(PROJECTION, {"months": 6}).json()["projection"]
    items = [it for m in proj for it in m["items"]]
    assert [it["source"] for it in items].count("invoice") == 1  # a obrigação de caixa é a fatura
    assert not any(it["description"] == "TV" for it in items)  # a compra em si não vira saída de caixa
    assert sum(D(m["expense_confirmed"]) for m in proj) == D("600.00")

    s = auth_client.get(SUMMARY).json()["indicators"]
    assert s["current_balance"] == "2000.00"  # compra no cartão não mexe no saldo
    assert s["expense_pending"] == "600.00"  # mas é despesa de consumo do mês

    inv = auth_client.get("/api/v1/credit-cards/invoices/").json()["results"][0]
    auth_client.post(f"/api/v1/credit-cards/invoices/{inv['id']}/pay/", {"account": acc.pk}, format="json")
    s = auth_client.get(SUMMARY).json()["indicators"]
    assert s["current_balance"] == "1400.00" and s["expense_paid"] == "600.00" and s["expense_pending"] == "0.00"  # sem dupla contagem
    assert not any(it["source"] == "invoice" for m in auth_client.get(PROJECTION).json()["projection"] for it in m["items"])


# ---------------------------------------------------------------- projeção
def test_projection_formula_and_chaining(auth_client, user):
    acc = make_account(user, balance="1000.00")
    tx(auth_client, user, acc, "income", "500.00", d=in_days(1), status="pending")
    tx(auth_client, user, acc, "expense", "200.00", d=add_months(today(), 1), status="pending")
    p = auth_client.get(PROJECTION, {"months": 3}).json()["projection"]
    assert [m["month"] for m in p][0] == today().strftime("%Y-%m") and len(p) == 3
    for prev, cur in zip(p, p[1:], strict=False):
        assert cur["opening_balance"] == prev["closing_balance"]  # encadeado
    end = D(p[-1]["closing_balance"])
    assert end == D("1000.00") + D("500.00") - D("200.00")


def test_projection_separates_confirmed_from_estimated(auth_client, user):
    acc = make_account(user, balance="1000.00")
    auth_client.post("/api/v1/recurring/", dict(description="Freelance", type="income", amount="2000.00", category=cat(user, "income", "Renda extra").pk,
                     account=acc.pk, frequency="monthly", start_date=iso(today()), variable=True), format="json")  # fmt: skip
    tx(auth_client, user, acc, "income", "100.00", d=today(), status="pending")  # hoje: sempre no mês 0
    p = auth_client.get(PROJECTION, {"months": 3}).json()["projection"]
    m0 = p[0]
    assert D(m0["income_estimated"]) == D("2000.00") and D(m0["income_confirmed"]) == D("100.00")
    # saldo conservador não conta receita estimada
    assert D(m0["closing_balance"]) - D(m0["closing_balance_conservative"]) == D("2000.00")
    assert all(it["estimate"] for it in m0["items"] if it["description"] == "Freelance")


def test_overdue_lands_in_first_month_and_raises_alert(auth_client, user):
    acc = make_account(user, balance="100.00")
    tx(auth_client, user, acc, "expense", "40.00", d=in_days(-20), status="pending", description="Aluguel atrasado")
    p = auth_client.get(PROJECTION, {"months": 3}).json()["projection"]
    item = next(it for it in p[0]["items"] if it["description"] == "Aluguel atrasado")
    assert item["overdue"] is True and p[0]["expense_confirmed"] == "40.00"
    codes = {a["code"] for a in auth_client.get(SUMMARY).json()["alerts"]}
    assert "overdue" in codes


def test_negative_projection_alert(auth_client, user):
    acc = make_account(user, balance="10.00")
    tx(auth_client, user, acc, "expense", "500.00", d=in_days(1), status="pending")
    assert "negative_projection" in {a["code"] for a in auth_client.get(SUMMARY).json()["alerts"]}


def test_upcoming_flags_due_soon(auth_client, user):
    acc = make_account(user)
    tx(auth_client, user, acc, "expense", "30.00", d=in_days(3), status="pending", description="Internet")
    up = auth_client.get(SUMMARY).json()["upcoming"]
    row = next(u for u in up if u["description"] == "Internet")
    assert row["status"] == "due_soon" and row["days_left"] == 3


# ---------------------------------------------------------------- simulador
def test_simulation_compares_scenarios_without_persisting(auth_client, user):
    acc = make_account(user, balance="5000.00")
    before = T.objects.count()
    r = auth_client.post(SIMULATE, dict(amount="1200.00", installments=4, first_date=iso(today()), months=6), format="json")
    assert r.status_code == 200
    d = r.json()
    assert T.objects.count() == before and d["persisted"] is False
    assert d["monthly_installment"] == "300.00" and len(d["months_affected"]) == 4
    assert D(d["baseline"][-1]["closing_balance"]) - D(d["with_purchase"][-1]["closing_balance"]) == D("1200.00")
    assert d["impact"][0]["affected"] is True and d["impact"][-1]["affected"] is False  # 4 de 6 meses
    assert d["impact"][3]["accumulated_impact"] == "1200.00"
    assert d["becomes_negative_in"] == []
    del acc


def test_simulation_flags_months_that_go_negative(auth_client, user):
    make_account(user, balance="500.00")
    d = auth_client.post(SIMULATE, dict(amount="1000.00", installments=2, first_date=iso(today()), months=3), format="json").json()
    assert d["becomes_negative_in"] == [today().strftime("%Y-%m")] or len(d["becomes_negative_in"]) >= 1


def test_dashboard_validation_and_isolation(auth_client, user, other_user, client):
    assert auth_client.get(SUMMARY, {"month": "2026-13"}).status_code == 400
    assert auth_client.get(SUMMARY, {"month": "novembro"}).status_code == 400
    assert auth_client.get(PROJECTION, {"months": 5}).status_code == 400
    assert auth_client.post(SIMULATE, dict(amount="0", installments=2, first_date=iso(today())), format="json").status_code == 400
    acc = make_account(other_user, balance="9999.00")
    tx_alheia = T.objects.create(owner=other_user, type="income", description="X", amount=1, account=acc, category=cat(other_user, "income"), date=today())
    assert tx_alheia.pk
    assert auth_client.get(SUMMARY).json()["indicators"]["current_balance"] == "0.00"
    for url in (SUMMARY, PROJECTION):
        assert client.get(url).status_code == 403


# ---------------------------------------------------------------- relatórios
def period():
    f, l = month_bounds(today().year, today().month)
    return {"date_from": iso(f), "date_to": iso(l)}


def test_report_totals_categories_and_cards(auth_client, user):
    acc = make_account(user)
    tx(auth_client, user, acc, "income", "3000.00")
    tx(auth_client, user, acc, "expense", "600.00")
    tx(auth_client, user, acc, "expense", "400.00", category=cat(user, "expense", "Lazer").pk)
    card = auth_client.post("/api/v1/credit-cards/", dict(name="Visa", credit_limit="5000", closing_day=10, due_day=20), format="json").json()["id"]
    auth_client.post(f"/api/v1/credit-cards/{card}/purchases/", dict(description="TV", amount="500.00", category=cat(user).pk, date=iso(today())), format="json")

    r = auth_client.get("/api/v1/reports/summary/", period()).json()
    assert r["totals"] == {"income": "3000.00", "expense": "1500.00", "result": "1500.00", "committed_percent": 50.0}
    cats = {c["name"]: c for c in r["expense_by_category"]}
    assert cats["Alimentação"]["amount"] == "1100.00" and cats["Lazer"]["percent"] == 26.7
    assert r["by_card"] == [{"card": "Visa", "amount": "500.00", "purchases": 1}]
    assert len(r["monthly"]) == 1 and r["future_commitments"] and r["largest_expenses"][0]["amount"] == "600.00"


def test_report_monthly_comparison_variation(auth_client, user):
    acc = make_account(user)
    prev = add_months(today().replace(day=1), -1)
    tx(auth_client, user, acc, "expense", "100.00", d=prev)
    tx(auth_client, user, acc, "expense", "150.00")
    q = {"date_from": iso(prev), "date_to": period()["date_to"]}
    m = auth_client.get("/api/v1/reports/summary/", q).json()["monthly"]
    assert [x["expense"] for x in m] == ["100.00", "150.00"] and m[1]["expense_variation_percent"] == 50.0


def test_report_period_validation(auth_client):
    assert auth_client.get("/api/v1/reports/summary/", {"date_from": "2026-02-01", "date_to": "2026-01-01"}).status_code == 400
    assert auth_client.get("/api/v1/reports/summary/", {"date_from": "2010-01-01", "date_to": "2026-01-01"}).status_code == 400
    assert auth_client.get("/api/v1/reports/summary/").status_code == 400


def test_csv_export_is_excel_friendly_and_formula_safe(auth_client, user):
    acc = make_account(user)
    tx(auth_client, user, acc, "expense", "1234.50", description="=HYPERLINK(\"http://x\")")
    tx(auth_client, user, acc, "expense", "10.00", description="Padaria — pão")
    resp = auth_client.get("/api/v1/reports/export/csv/", period())
    assert resp.status_code == 200 and resp["Content-Type"].startswith("text/csv") and "attachment" in resp["Content-Disposition"]
    raw = resp.content
    assert raw.startswith(b"\xef\xbb\xbf")
    rows = list(csv.reader(io.StringIO(raw.decode("utf-8-sig")), delimiter=";"))
    assert rows[0] == ["Data", "Tipo", "Descrição", "Categoria", "Conta/Cartão", "Valor", "Situação", "Data efetiva"]
    descs = [r[2] for r in rows[1:]]
    assert "'=HYPERLINK(\"http://x\")" in descs  # prefixo neutraliza a fórmula
    assert "Padaria — pão" in descs
    assert any(r[5] == "1234,50" for r in rows[1:])


def test_pdf_export_returns_a_pdf(auth_client, user):
    acc = make_account(user)
    tx(auth_client, user, acc, "expense", "10.00")
    resp = auth_client.get("/api/v1/reports/export/pdf/", period())
    assert resp.status_code == 200 and resp["Content-Type"] == "application/pdf"
    assert resp.content.startswith(b"%PDF") and len(resp.content) > 1000


def test_reports_require_auth_and_are_isolated(client, auth_client, other_user):
    for path in ("summary/", "export/csv/", "export/pdf/"):
        assert client.get(f"/api/v1/reports/{path}", period()).status_code == 403
    acc = make_account(other_user)
    T.objects.create(owner=other_user, type="expense", description="Privado", amount=999, account=acc, category=cat(other_user), date=today())
    assert auth_client.get("/api/v1/reports/summary/", period()).json()["totals"]["expense"] == "0.00"
    assert b"Privado" not in auth_client.get("/api/v1/reports/export/csv/", period()).content
