import dataclasses
import json

import pytest

from account_service import jobs
from account_service.cashfree import sign
from account_service.core import DAY

from .conftest import make_settings, sign_in

BILLING = {"name": "Asha Rao", "phone": "+91 98765 43210", "state": "Kerala"}


def checkout(client, plan="plus", period="monthly", **over):
    return client.post("/api/billing/checkout", json={"plan": plan, "period": period, **BILLING, **over})


def webhook(client, payload: dict, now: int, secret="whsec", ts=None):
    raw = json.dumps(payload).encode()
    ts = ts or str(now * 1000)
    return client.post(
        "/api/billing/webhook/cashfree",
        content=raw,
        headers={
            "x-webhook-timestamp": ts,
            "x-webhook-signature": sign(secret, ts, raw),
            "content-type": "application/json",
        },
    )


def test_plans_are_public(client):
    p = client.get("/api/plans").json()
    assert p["plans"]["plus"]["prices"]["monthly"] == 29_900
    assert "Kerala" in p["states"]
    assert p["payments"] == "fake"


def test_checkout_checks_the_form(client, signed_in):
    assert checkout(client, plan="free").status_code == 400
    assert checkout(client, state="Atlantis").status_code == 400
    assert checkout(client, phone="12345").status_code == 422
    assert checkout(client, phone="12345abcdefg").status_code == 400
    assert checkout(client, gstin="BADGSTIN").status_code == 400


def test_fake_checkout_unlocks_plus_and_issues_a_gst_invoice(client, signed_in, svc):
    r = checkout(client).json()
    assert r["amount"] == 35_282 and r["tax"]["igst"] == 5_382  # Kerala buyer, Karnataka seller
    page = client.get(r["url"])
    assert "352.82" in page.text
    done = client.post(r["url"], follow_redirects=False)
    assert done.status_code == 303 and done.headers["location"] == "/?billing=return"
    me = client.get("/api/me").json()
    assert me["plan"] == "plus" and me["source"] == "subscription"
    assert me["subscription"]["status"] == "active"
    # the export that was locked is now allowed
    assert client.post("/api/usage/export", json={"format": "stl"}).status_code == 200
    invoices = client.get("/api/billing/invoices").json()["invoices"]
    assert len(invoices) == 1 and invoices[0]["number"] == "MM/2026-27/000001"
    inv = client.get(f"/api/billing/invoices/{invoices[0]['id']}").json()
    assert (inv["base"], inv["igst"], inv["total"]) == (29_900, 5_382, 35_282)
    assert inv["seller"]["gstin"] == "29ABCDE1234F1Z5"
    assert inv["lines"][0]["sac"] == "997331"
    assert any("receipt" in m.subject for m in svc.email.sent)


def test_same_state_invoice_uses_cgst_and_sgst(client, signed_in):
    r = checkout(client, state="Karnataka", gstin="29ABCDE1234F1Z5").json()
    client.post(r["url"])
    inv_id = client.get("/api/billing/invoices").json()["invoices"][0]["id"]
    inv = client.get(f"/api/billing/invoices/{inv_id}").json()
    assert (inv["cgst"], inv["sgst"], inv["igst"]) == (2_691, 2_691, 0)
    assert inv["billing_gstin"] == "29ABCDE1234F1Z5"


def test_webhook_signatures(client, signed_in, clock):
    payload = {"type": "PAYMENT_SUCCESS_WEBHOOK", "data": {"order": {"order_id": "sub_x"}, "payment": {}}}
    assert webhook(client, payload, clock.t).status_code == 200
    assert webhook(client, payload, clock.t, secret="wrong").status_code == 401
    assert webhook(client, payload, clock.t, ts=str((clock.t - 600) * 1000)).status_code == 401  # too old
    raw = json.dumps(payload).encode()
    r = client.post("/api/billing/webhook/cashfree", content=raw)
    assert r.status_code == 401


def test_monthly_renewals_extend_and_repeats_are_ignored(client, signed_in, svc, clock):
    sub_id = checkout(client).json()["subscriptionId"]
    client.post(f"/api/billing/fake/{sub_id}")
    end1 = client.get("/api/me").json()["subscription"]["currentPeriodEnd"]
    event = {
        "type": "SUBSCRIPTION_PAYMENT_SUCCESS",
        "data": {
            "subscription_id": sub_id,
            "cf_payment_id": "cf-2",
            "payment_amount": 352.82,
            "payment_status": "SUCCESS",
        },
    }
    clock.t += 29 * DAY
    assert webhook(client, event, clock.t).status_code == 200
    assert webhook(client, event, clock.t).status_code == 200  # Cashfree retries: counted once
    end2 = client.get("/api/me").json()["subscription"]["currentPeriodEnd"]
    assert end2 > end1 + 27 * DAY
    assert len(client.get("/api/billing/invoices").json()["invoices"]) == 2


def test_failed_payment_marks_past_due_but_keeps_access(client, signed_in, clock, svc):
    sub_id = checkout(client).json()["subscriptionId"]
    client.post(f"/api/billing/fake/{sub_id}")
    event = {
        "type": "SUBSCRIPTION_PAYMENT_FAILED",
        "data": {"subscription_id": sub_id, "cf_payment_id": "cf-9", "payment_status": "FAILED"},
    }
    webhook(client, event, clock.t)
    me = client.get("/api/me").json()
    assert me["subscription"]["status"] == "past_due" and me["plan"] == "plus"
    assert svc.email.sent[-1].subject == "Your MathMe payment did not go through"


def test_upgrading_to_pro_stops_plus_renewing(client, signed_in):
    client.post(checkout(client).json()["url"])
    client.post(checkout(client, plan="pro", period="annual").json()["url"])
    me = client.get("/api/me").json()
    assert me["plan"] == "pro" and me["limits"]["priority"] is True


def test_cancel_keeps_access_until_the_end_then_free(client, signed_in, clock, svc):
    client.post(checkout(client).json()["url"])
    assert client.post("/api/billing/cancel").status_code == 200
    me = client.get("/api/me").json()
    assert me["plan"] == "plus" and me["subscription"]["cancelAtPeriodEnd"] is True
    assert client.post("/api/billing/cancel").status_code == 400  # nothing left to cancel
    clock.t += 32 * DAY
    sign_in(client)  # the old session has expired too
    assert client.get("/api/me").json()["plan"] == "free"
    import asyncio

    result = asyncio.run(jobs.daily(svc))
    assert result["expired"] == 1


def test_annual_plan_reminders(client, signed_in, clock, svc):
    client.post(checkout(client, period="annual").json()["url"])
    import asyncio

    clock.t += 352 * DAY  # 13 days left of 365
    asyncio.run(jobs.daily(svc))
    asyncio.run(jobs.daily(svc))  # only one reminder per mark
    clock.t += 11 * DAY  # 2 days left
    asyncio.run(jobs.daily(svc))
    reminders = [m for m in svc.email.sent if "year ends" in m.subject]
    assert len(reminders) == 2


@pytest.fixture
def cashfree_client(tmp_path, http, clock):
    from fastapi.testclient import TestClient

    from account_service.app import create_app
    from account_service.db import SqliteDb
    from account_service.services import Services
    from account_service.storage import LocalBucket

    db = SqliteDb(":memory:")
    db.migrate()
    settings = make_settings(payments="cashfree", cashfree_client_id="cid", cashfree_client_secret="csec")
    c = TestClient(create_app(Services(settings, db, LocalBucket(tmp_path), http, clock=clock)))
    c.headers["X-MathMe"] = "1"
    return c


def test_cashfree_monthly_creates_a_mandate(cashfree_client, http, clock):
    sign_in(cashfree_client)
    http.on(
        "POST",
        "https://sandbox.cashfree.com/pg/subscriptions",
        body={"subscription_session_id": "sess-1", "cf_subscription_id": "cf-1"},
    )
    r = cashfree_client.post("/api/billing/checkout", json={"plan": "pro", "period": "monthly", **BILLING}).json()
    assert r == {**r, "provider": "cashfree", "kind": "subscription", "sessionId": "sess-1", "mode": "sandbox"}
    method, url, headers, body = http.calls[-1]
    sent = json.loads(body)
    assert headers["x-client-id"] == "cid" and headers["x-api-version"] == "2025-01-01"
    assert sent["plan_details"]["plan_amount"] == 942.82
    assert sent["authorization_details"]["authorization_amount"] == 942.82
    assert sent["customer_details"]["customer_phone"] == "9876543210"
    # the mandate is authorised: the first month is paid
    payload = {
        "type": "SUBSCRIPTION_STATUS_CHANGED",
        "event_time": "1",
        "data": {"subscription_details": {"subscription_id": r["subscriptionId"], "subscription_status": "ACTIVE"}},
    }
    assert webhook(cashfree_client, payload, clock.t).status_code == 200
    me = cashfree_client.get("/api/me").json()
    assert me["plan"] == "pro"
    # a cancel tells Cashfree
    http.on("POST", "https://sandbox.cashfree.com/pg/subscriptions/", body={})
    assert cashfree_client.post("/api/billing/cancel").status_code == 200
    assert http.calls[-1][1].endswith(f"/subscriptions/{r['subscriptionId']}/manage")


def test_cashfree_annual_is_an_order_and_errors_are_explained(cashfree_client, http):
    sign_in(cashfree_client)
    http.on("POST", "https://sandbox.cashfree.com/pg/orders", body={"payment_session_id": "ps-1"})
    r = cashfree_client.post("/api/billing/checkout", json={"plan": "plus", "period": "annual", **BILLING}).json()
    assert r["kind"] == "order" and r["sessionId"] == "ps-1"
    assert json.loads(http.calls[-1][3])["order_amount"] == 2948.82
    http.on("POST", "https://sandbox.cashfree.com/pg/orders", status=400, body={"message": "phone invalid"})
    bad = cashfree_client.post("/api/billing/checkout", json={"plan": "plus", "period": "annual", **BILLING})
    assert bad.status_code == 502 and "phone invalid" in bad.json()["detail"]
    assert cashfree_client.get("/api/billing/fake/sub_x").status_code == 404  # no fake checkout in production mode


def test_a_live_site_never_takes_fake_payments_or_test_sign_in(client, signed_in, svc):
    # the same settings, but at a public address: a forgotten PAYMENTS or AUTH_TEST_LOGIN must not open the door
    pending = checkout(client).json()["subscriptionId"]
    svc.settings = dataclasses.replace(svc.settings, public_url="https://mathme.app")
    assert client.post("/api/auth/test-login", json={"email": "owner@mathme.app"}).status_code == 404
    assert client.get("/api/me").json()["signinAvailable"] is True  # Google still works
    assert checkout(client).status_code == 503
    assert client.get(f"/api/billing/fake/{pending}").status_code == 404
    assert client.post(f"/api/billing/fake/{pending}").status_code == 404
    assert client.get("/api/me").json()["plan"] == "free"
