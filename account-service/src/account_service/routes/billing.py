"""Plans, checkout (Cashfree or the fake test provider), webhooks, invoices and cancelling."""

from __future__ import annotations

import datetime as dt
import html
import json
import logging
import re

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel, Field

from .. import plans
from ..cashfree import Event, PaymentError, fake_event, parse_event, verify
from ..core import (
    add_months,
    new_id,
    record_payment,
    require_csrf,
    require_user,
    services,
)
from ..gst import STATES, add_gst, rupees, valid_gstin
from ..services import Services

log = logging.getLogger("mathme.billing")
router = APIRouter()


@router.get("/api/plans")
async def get_plans(request: Request):
    s = services(request)
    return {
        **plans.catalogue(),
        "states": STATES,
        "sellerState": s.settings.seller_state,
        "payments": s.settings.payments,
        "cashfreeMode": "production" if s.settings.cashfree_env == "production" else "sandbox",
    }


class Checkout(BaseModel):
    plan: str
    period: str
    name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=10, max_length=15)
    state: str
    gstin: str = Field(default="", max_length=15)


def _description(plan: str, period: str) -> str:
    p = plans.plan(plan)
    return f"MathMe {p['label']} ({p['name']}), {'1 year' if period == 'annual' else '1 month'}"


@router.post("/api/billing/checkout", dependencies=[Depends(require_csrf)])
async def checkout(request: Request, body: Checkout, user: dict = Depends(require_user)):
    s = services(request)
    if body.plan not in ("plus", "pro") or body.period not in ("monthly", "annual"):
        raise HTTPException(400, "Choose Plus or Pro, monthly or yearly.")
    if body.state not in STATES:
        raise HTTPException(400, "Choose your state (it decides how GST is shown on the invoice).")
    phone = re.sub(r"\D", "", body.phone)[-10:]
    if len(phone) != 10:
        raise HTTPException(400, "Enter a 10-digit mobile number (payment providers need one).")
    gstin = body.gstin.strip().upper()
    if gstin and not valid_gstin(gstin):
        raise HTTPException(400, "That GSTIN does not look right. Leave it empty if you do not have one.")
    if s.settings.payments != "cashfree" and not s.settings.fake_payments:
        raise HTTPException(503, "Payments are not switched on yet. Please try again later.")
    base = plans.price(body.plan, body.period)
    tax = add_gst(base, s.settings.seller_state, body.state)
    now = s.now()
    sub_id = new_id("sub")
    await s.db.run(
        """INSERT INTO subscriptions (id, user_id, plan, period, status, provider, provider_ref, billing_name,
           billing_state, billing_gstin, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)""",
        sub_id, user["id"], body.plan, body.period, s.settings.payments, sub_id, body.name, body.state, gstin, now, now,
    )  # fmt: skip
    summary = {"subscriptionId": sub_id, "amount": tax.total, "tax": tax.dict()}
    return_url = f"{s.settings.public_url}/?billing=return"
    if s.settings.payments != "cashfree":
        return {**summary, "provider": "fake", "url": f"/api/billing/fake/{sub_id}"}
    customer = {"id": user["id"], "name": body.name, "email": user["email"], "phone": phone}
    try:
        if body.period == "monthly":
            first = dt.datetime.fromtimestamp(add_months(now, 1), dt.UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
            made = await s.cashfree.create_subscription(
                ref=sub_id,
                plan_label=_description(body.plan, body.period),
                amount=tax.total,
                customer=customer,
                return_url=return_url,
                first_charge_iso=first,
            )
            kind = "subscription"
        else:
            made = await s.cashfree.create_order(
                ref=sub_id,
                amount=tax.total,
                customer=customer,
                return_url=return_url,
                notify_url=f"{s.settings.public_url}/api/billing/webhook/cashfree",
            )
            kind = "order"
    except PaymentError as err:
        await s.db.run("UPDATE subscriptions SET status = 'expired' WHERE id = ?", sub_id)
        raise HTTPException(502, f"The payment provider said: {err}") from err
    return {
        **summary,
        "provider": "cashfree",
        "kind": kind,
        "sessionId": made["sessionId"],
        "mode": s.settings.cashfree_env,
    }


@router.post("/api/billing/cancel", dependencies=[Depends(require_csrf)])
async def cancel(request: Request, user: dict = Depends(require_user)):
    """Stop renewing. Access stays until the end of the period already paid for."""
    s = services(request)
    subs = await s.db.all(
        "SELECT * FROM subscriptions WHERE user_id = ? AND status IN ('active', 'past_due')", user["id"]
    )
    if not subs:
        raise HTTPException(400, "There is no renewing plan to cancel.")
    for sub in subs:
        if sub["provider"] == "cashfree" and sub["period"] == "monthly":
            try:
                await s.cashfree.cancel_subscription(sub["provider_ref"])
            except PaymentError as err:
                raise HTTPException(502, f"The payment provider said: {err}") from err
        await s.db.run(
            "UPDATE subscriptions SET status = 'cancelled', cancel_at_period_end = 1, updated_at = ? WHERE id = ?",
            s.now(),
            sub["id"],
        )
    return {"ok": True}


@router.get("/api/billing/invoices")
async def list_invoices(request: Request, user: dict = Depends(require_user)):
    s = services(request)
    rows = await s.db.all(
        """SELECT i.id, i.number, i.issued_at, p.total, p.description FROM invoices i
           JOIN payments p ON p.id = i.payment_id WHERE i.user_id = ? ORDER BY i.issued_at DESC""",
        user["id"],
    )
    return {"invoices": rows}


async def invoice_detail(s: Services, invoice_id: str) -> dict | None:
    row = await s.db.one(
        """SELECT i.*, p.base, p.cgst, p.sgst, p.igst, p.total, p.description, p.provider, p.provider_ref
           FROM invoices i JOIN payments p ON p.id = i.payment_id WHERE i.id = ?""",
        invoice_id,
    )
    if not row:
        return None
    st = s.settings
    return {
        **row,
        "lines": json.loads(row["lines"]),
        "seller": {
            "name": st.seller_name,
            "address": st.seller_address,
            "state": st.seller_state,
            "gstin": st.seller_gstin,
            "email": st.support_email,
        },
    }


@router.get("/api/billing/invoices/{invoice_id}")
async def get_invoice(request: Request, invoice_id: str, user: dict = Depends(require_user)):
    s = services(request)
    inv = await invoice_detail(s, invoice_id)
    if not inv or (inv["user_id"] != user["id"] and user["role"] != "owner"):
        raise HTTPException(404, "Invoice not found.")
    return inv


# ---------------------------------------------------------------- what payments do


async def _receipt(s: Services, to: str, paid: dict, what: str) -> None:
    gst = (
        f"IGST 18%: ₹{rupees(paid['igst'])}"
        if paid["igst"]
        else f"CGST 9%: ₹{rupees(paid['cgst'])}, SGST 9%: ₹{rupees(paid['sgst'])}"
    )
    await s.email.send(
        to,
        f"MathMe receipt {paid['number']}",
        f"Thank you! We received your payment for {what}.\n\n"
        f"Price: ₹{rupees(paid['base'])}\n{gst}\nTotal paid: ₹{rupees(paid['total'])}\n\n"
        f"Invoice {paid['number']} is in MathMe under Settings → Account.\n\n"
        f"{s.settings.seller_name}",
    )


async def _subscription_paid(s: Services, sub: dict, payment_ref: str) -> None:
    now = s.now()
    months = 12 if sub["period"] == "annual" else 1
    start = now if sub["status"] == "pending" else max(now, int(sub["current_period_end"] or now))
    user = await s.db.one("SELECT * FROM users WHERE id = ?", sub["user_id"])
    paid = await record_payment(
        s,
        description=_description(sub["plan"], sub["period"]),
        base=plans.price(sub["plan"], sub["period"]),
        buyer_state=sub["billing_state"],
        provider=sub["provider"],
        provider_ref=payment_ref,
        billing_name=sub["billing_name"],
        billing_email=user["email"] if user else "",
        billing_gstin=sub["billing_gstin"],
        user_id=sub["user_id"],
        subscription_id=sub["id"],
    )
    if paid is None:
        return  # already counted this payment
    status = "cancelled" if sub["cancel_at_period_end"] else "active"
    await s.db.run(
        "UPDATE subscriptions SET status = ?, current_period_end = ?, updated_at = ? WHERE id = ?",
        status,
        add_months(start, months),
        now,
        sub["id"],
    )
    # moving to a new plan: the old one stops renewing (it keeps running until its paid period ends)
    others = await s.db.all(
        "SELECT * FROM subscriptions WHERE user_id = ? AND id != ? AND status IN ('active', 'past_due')",
        sub["user_id"],
        sub["id"],
    )
    for old in others:
        if old["provider"] == "cashfree" and old["period"] == "monthly":
            try:
                await s.cashfree.cancel_subscription(old["provider_ref"])
            except PaymentError:
                log.warning("could not cancel old subscription %s", old["id"])
        await s.db.run(
            "UPDATE subscriptions SET status = 'cancelled', cancel_at_period_end = 1, updated_at = ? WHERE id = ?",
            now,
            old["id"],
        )
    if user:
        await _receipt(s, user["email"], paid, _description(sub["plan"], sub["period"]))


async def _org_paid(s: Services, link_ref: str, payment_ref: str) -> None:
    org_id = link_ref.split("__")[0].removeprefix("lnk_")
    org = await s.db.one("SELECT * FROM orgs WHERE id = ?", org_id)
    if not org:
        return
    paid = await record_payment(
        s,
        description=f"MathMe Campus licence, 1 year: {org['name']}",
        base=plans.price("campus", "annual"),
        buyer_state=org["billing_state"],
        provider=s.settings.payments,
        provider_ref=payment_ref,
        billing_name=org["name"],
        billing_email=org["billing_email"],
        billing_gstin=org["billing_gstin"],
        org_id=org_id,
    )
    if paid is None:
        return
    await s.db.run("UPDATE orgs SET status = 'paid' WHERE id = ?", org_id)
    if org["billing_email"]:
        await _receipt(s, org["billing_email"], paid, "a MathMe Campus licence")


async def handle_event(s: Services, event: Event) -> None:
    if await s.db.one("SELECT id FROM webhook_events WHERE id = ?", event.id):
        return  # a repeated delivery
    await s.db.run("INSERT INTO webhook_events (id, received_at) VALUES (?, ?)", event.id, s.now())
    if event.ref.startswith("lnk_"):
        if event.kind == "payment" and event.status == "SUCCESS":
            await _org_paid(s, event.ref, event.payment_ref or event.id)
        return
    sub = await s.db.one("SELECT * FROM subscriptions WHERE id = ? OR provider_ref = ?", event.ref, event.ref)
    if not sub:
        log.info("webhook for an unknown reference %s", event.ref)
        return
    if event.kind == "payment":
        if event.status == "SUCCESS":
            await _subscription_paid(s, sub, event.payment_ref or event.id)
        elif sub["status"] == "active":
            await s.db.run(
                "UPDATE subscriptions SET status = 'past_due', updated_at = ? WHERE id = ?", s.now(), sub["id"]
            )
            user = await s.db.one("SELECT email, name FROM users WHERE id = ?", sub["user_id"])
            if user:
                await s.email.send(
                    user["email"],
                    "Your MathMe payment did not go through",
                    f"Hello {user['name'] or 'there'},\n\nThis month's payment for your MathMe "
                    f"{plans.plan(sub['plan'])['label']} plan did not go through. Cashfree will try again; "
                    "please check that your UPI AutoPay, card or bank mandate is still active. You keep your plan "
                    "until the end of the period you have paid for.\n\n"
                    f"{s.settings.seller_name}",
                )
        return
    # status changes
    status = event.status.upper()
    if status == "ACTIVE" and sub["status"] == "pending":
        # the mandate was authorised, and the authorisation charged the first month
        await _subscription_paid(s, sub, f"{sub['id']}:first")
    elif status in {"CANCELLED", "COMPLETED", "CUSTOMER_CANCELLED", "EXPIRED"}:
        await s.db.run(
            "UPDATE subscriptions SET status = 'cancelled', cancel_at_period_end = 1, updated_at = ? WHERE id = ?",
            s.now(),
            sub["id"],
        )
    elif status in {"ON_HOLD", "CUSTOMER_PAUSED"} and sub["status"] == "active":
        await s.db.run("UPDATE subscriptions SET status = 'past_due', updated_at = ? WHERE id = ?", s.now(), sub["id"])


@router.post("/api/billing/webhook/cashfree")
async def cashfree_webhook(request: Request):
    s = services(request)
    raw = await request.body()
    if not verify(
        s.settings.cashfree_webhook_secret,
        request.headers.get("x-webhook-timestamp"),
        request.headers.get("x-webhook-signature"),
        raw,
        s.now(),
    ):
        raise HTTPException(401, "Bad signature.")
    try:
        payload = json.loads(raw)
    except ValueError as err:
        raise HTTPException(400, "Bad JSON.") from err
    event = parse_event(payload)
    if event:
        await handle_event(s, event)
    return {"ok": True}


# ---------------------------------------------------------------- the fake provider (development and tests)


def _fake_only(s: Services) -> None:
    if not s.settings.fake_payments:  # PAYMENTS=fake, and only on localhost
        raise HTTPException(404, "Not found")


async def _fake_amount(s: Services, ref: str) -> tuple[str, int, str]:
    if ref.startswith("lnk_"):
        org = await s.db.one("SELECT * FROM orgs WHERE id = ?", ref.split("__")[0].removeprefix("lnk_"))
        if not org:
            raise HTTPException(404, "Not found")
        tax = add_gst(plans.price("campus", "annual"), s.settings.seller_state, org["billing_state"])
        return "link", tax.total, f"Campus licence for {org['name']}"
    sub = await s.db.one("SELECT * FROM subscriptions WHERE id = ?", ref)
    if not sub:
        raise HTTPException(404, "Not found")
    tax = add_gst(plans.price(sub["plan"], sub["period"]), s.settings.seller_state, sub["billing_state"])
    return (
        ("subscription" if sub["period"] == "monthly" else "order"),
        tax.total,
        _description(sub["plan"], sub["period"]),
    )


@router.get("/api/billing/fake/{ref}", response_class=HTMLResponse)
async def fake_checkout_page(request: Request, ref: str):
    s = services(request)
    _fake_only(s)
    _, amount, what = await _fake_amount(s, ref)
    return f"""<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Test payment</title>
<body style="font-family:system-ui;max-width:420px;margin:60px auto;padding:0 16px">
<h1>Test payment</h1><p>This is MathMe's pretend checkout for development. No money moves.</p>
<p><b>{html.escape(what)}</b><br>Total with GST: ₹{rupees(amount)}</p>
<form method="post">
<button style="font-size:18px;padding:10px 20px" data-testid="fake-pay">Pay ₹{rupees(amount)} (test)</button>
</form>
<p><a href="/?billing=cancelled">Cancel</a></p></body>"""


@router.post("/api/billing/fake/{ref}")
async def fake_pay(request: Request, ref: str):
    s = services(request)
    _fake_only(s)
    kind, amount, _ = await _fake_amount(s, ref)
    now = s.now()
    # the same event shape and handler as a real Cashfree webhook
    body = fake_event(kind, ref, amount, new_id("fakepay"), now)
    event = parse_event(json.loads(body))
    if event:
        await handle_event(s, event)
    return RedirectResponse("/?billing=return" if kind != "link" else "/?campus=paid", status_code=303)
