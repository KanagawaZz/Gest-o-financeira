from decimal import Decimal

from apps.audit.models import AuditLog
from apps.goals.models import Goal
from apps.transactions.models import Transaction as T
from common.utilities.dates import add_months

from .helpers import balance, cat, iso, make_account, today

GOALS = "/api/v1/goals/"


def make_goal(client, **kw):
    body = dict(name="Viagem", target_amount="4000.00", target_date=iso(add_months(today(), 8)))
    body.update(kw)
    return client.post(GOALS, body, format="json")


def contribute(client, gid, src, dst, amount="500.00"):
    return client.post(f"{GOALS}{gid}/contributions/", dict(amount=amount, date=iso(today()), account=src.pk, destination_account=dst.pk), format="json")


def test_goal_alone_has_no_saved_money(auth_client):
    g = make_goal(auth_client).json()
    assert g["progress"]["current_amount"] == "0.00" and g["progress"]["progress_percent"] == 0


def test_contribution_is_a_real_transfer_and_counts(auth_client, user):
    src, reserve = make_account(user, "Corrente", "2000.00"), make_account(user, "Reserva", "0.00")
    gid = make_goal(auth_client).json()["id"]
    r = contribute(auth_client, gid, src, reserve, "500.00")
    assert r.status_code == 201
    assert balance(auth_client, src) == 1500 and balance(auth_client, reserve) == 500
    tx = T.objects.get(type="transfer")
    assert tx.description == "Meta: Viagem" and tx.status == "realized"

    p = auth_client.get(f"{GOALS}{gid}/").json()["progress"]
    assert p["current_amount"] == "500.00" and p["remaining_amount"] == "3500.00" and p["progress_percent"] == 12
    assert p["months_left"] == 8 and p["monthly_needed"] == "437.50"  # 3500 / 8


def test_voiding_contribution_removes_it_from_goal_and_balances(auth_client, user):
    src, reserve = make_account(user, "Corrente", "2000.00"), make_account(user, "Reserva", "0.00")
    gid = make_goal(auth_client).json()["id"]
    cid = contribute(auth_client, gid, src, reserve).json()["id"]
    assert auth_client.post(f"{GOALS}{gid}/contributions/{cid}/void/").status_code == 200
    assert balance(auth_client, src) == 2000 and balance(auth_client, reserve) == 0
    assert auth_client.get(f"{GOALS}{gid}/").json()["progress"]["current_amount"] == "0.00"
    assert auth_client.post(f"{GOALS}{gid}/contributions/{cid}/void/").status_code == 409


def test_voiding_the_underlying_transfer_also_updates_goal(auth_client, user):
    src, reserve = make_account(user, "Corrente", "2000.00"), make_account(user, "Reserva", "0.00")
    gid = make_goal(auth_client).json()["id"]
    contribute(auth_client, gid, src, reserve)
    tx = T.objects.get(type="transfer")
    auth_client.post(f"/api/v1/transactions/{tx.pk}/void/")
    assert auth_client.get(f"{GOALS}{gid}/").json()["progress"]["current_amount"] == "0.00"


def test_contribution_rules_and_overdue_goal(auth_client, user, other_user):
    src, reserve = make_account(user, "Corrente"), make_account(user, "Reserva", "0.00")
    gid = make_goal(auth_client, target_date=iso(add_months(today(), -2))).json()["id"]
    assert contribute(auth_client, gid, src, src).status_code == 400  # origem = destino
    assert contribute(auth_client, gid, src, make_account(other_user, "Alheia")).status_code == 400
    assert contribute(auth_client, gid, src, reserve, "0").status_code == 400
    assert auth_client.get(f"{GOALS}{gid}/").json()["progress"]["monthly_needed"] == "4000.00"  # meta vencida: tudo já


def test_goal_archive_and_isolation(auth_client, other_user):
    gid = make_goal(auth_client).json()["id"]
    assert auth_client.delete(f"{GOALS}{gid}/").status_code == 204
    assert Goal.objects.get(pk=gid).is_archived
    alheia = Goal.objects.create(owner=other_user, name="X", target_amount=Decimal("10"))
    assert auth_client.get(f"{GOALS}{alheia.pk}/").status_code == 404
    assert make_goal(auth_client, target_amount="0").status_code == 400


def test_audit_records_edits_of_realized_transactions(auth_client, user):
    acc = make_account(user)
    tx_id = auth_client.post("/api/v1/transactions/", dict(type="expense", description="Mercado", amount="100.00", category=cat(user).pk,
                             account=acc.pk, date=iso(today())), format="json").json()["id"]  # fmt: skip
    auth_client.patch(f"/api/v1/transactions/{tx_id}/", {"amount": "120.00"}, format="json")
    auth_client.post(f"/api/v1/transactions/{tx_id}/void/")
    logs = auth_client.get("/api/v1/audit/", {"model": "Transaction", "object_id": tx_id}).json()["results"]
    actions = [entry["action"] for entry in logs]
    assert {"transaction.created", "transaction.updated", "transaction.voided"} <= set(actions)
    upd = next(entry for entry in logs if entry["action"] == "transaction.updated")
    assert upd["changes"]["amount"] == ["100.00", "120.00"]


def test_audit_is_private_and_read_only(auth_client, user, other_user):
    AuditLog.objects.create(owner=other_user, action="x", model="Transaction", object_id=1)
    assert auth_client.get("/api/v1/audit/").json()["count"] == 0
    assert auth_client.post("/api/v1/audit/", {}, format="json").status_code == 405
