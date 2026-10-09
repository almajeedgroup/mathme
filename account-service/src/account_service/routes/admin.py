"""The owner's dashboard: numbers, enquiries, Campus licences and payments."""

from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from .. import jobs, metrics, plans
from ..cashfree import PaymentError
from ..core import DAY, add_months, new_id, record_payment, require_csrf, require_owner, services
from ..gst import STATES, add_gst, valid_gstin

router = APIRouter(dependencies=[Depends(require_csrf), Depends(require_owner)])

CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O or 1/I


def join_code() -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(8))


@router.get("/api/admin/metrics")
async def get_metrics(request: Request):
    return await metrics.compute(services(request))


@router.get("/api/admin/enquiries")
async def enquiries(request: Request):
    s = services(request)
    return {"enquiries": await s.db.all("SELECT * FROM enquiries ORDER BY created_at DESC LIMIT 200")}


class EnquiryStatus(BaseModel):
    status: str


@router.patch("/api/admin/enquiries/{enquiry_id}")
async def set_enquiry_status(request: Request, enquiry_id: str, body: EnquiryStatus):
    if body.status not in ("new", "contacted", "converted", "closed"):
        raise HTTPException(400, "Unknown status.")
    await services(request).db.run("UPDATE enquiries SET status = ? WHERE id = ?", body.status, enquiry_id)
    return {"ok": True}


class NewOrg(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    status: str = "pilot"
    months: int = Field(default=12, ge=1, le=36)
    studentSeats: int | None = Field(default=None, ge=1, le=100_000)
    teacherSeats: int | None = Field(default=None, ge=1, le=10_000)
    billingState: str = ""
    billingGstin: str = ""
    billingEmail: str = ""
    enquiryId: str | None = None


@router.post("/api/admin/orgs")
async def create_org(request: Request, body: NewOrg):
    s = services(request)
    if body.status not in ("pilot", "paid"):
        raise HTTPException(400, "Status must be pilot or paid.")
    if body.billingState and body.billingState not in STATES:
        raise HTTPException(400, "Unknown state.")
    if body.billingGstin and not valid_gstin(body.billingGstin):
        raise HTTPException(400, "That GSTIN does not look right.")
    seats = plans.plan("campus")["seats"]
    now = s.now()
    oid = new_id("org")
    await s.db.run(
        """INSERT INTO orgs (id, name, status, student_seats, teacher_seats, starts_at, ends_at, billing_state,
           billing_gstin, billing_email, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        oid, body.name, body.status, body.studentSeats or seats["students"], body.teacherSeats or seats["teachers"],
        now, add_months(now, body.months), body.billingState, body.billingGstin.upper(), body.billingEmail, now,
    )  # fmt: skip
    for role in ("teacher", "student"):
        await s.db.run("INSERT INTO org_codes (code, org_id, role) VALUES (?, ?, ?)", join_code(), oid, role)
    if body.enquiryId:
        await s.db.run("UPDATE enquiries SET status = 'converted', org_id = ? WHERE id = ?", oid, body.enquiryId)
    return {"id": oid}


@router.get("/api/admin/orgs")
async def list_orgs(request: Request):
    s = services(request)
    orgs = await s.db.all("SELECT * FROM orgs ORDER BY created_at DESC")
    for o in orgs:
        o["codes"] = await s.db.all("SELECT code, role FROM org_codes WHERE org_id = ?", o["id"])
        counts = await s.db.all("SELECT role, COUNT(*) AS n FROM org_members WHERE org_id = ? GROUP BY role", o["id"])
        o["used"] = {r["role"]: r["n"] for r in counts}
    return {"orgs": orgs}


class Extend(BaseModel):
    months: int = Field(ge=1, le=36)


@router.post("/api/admin/orgs/{org_id}/extend")
async def extend_org(request: Request, org_id: str, body: Extend):
    s = services(request)
    org = await s.db.one("SELECT * FROM orgs WHERE id = ?", org_id)
    if not org:
        raise HTTPException(404, "Not found")
    start = max(int(org["ends_at"]), s.now())
    status = org["status"] if org["status"] != "expired" else "pilot"
    await s.db.run(
        "UPDATE orgs SET ends_at = ?, status = ? WHERE id = ?", add_months(start, body.months), status, org_id
    )
    return {"ok": True}


class MarkPaid(BaseModel):
    reference: str = Field(min_length=2, max_length=120)


@router.post("/api/admin/orgs/{org_id}/mark-paid")
async def mark_paid(request: Request, org_id: str, body: MarkPaid):
    """A Campus licence paid outside MathMe (e.g. bank transfer): record it and issue the GST invoice."""
    s = services(request)
    org = await s.db.one("SELECT * FROM orgs WHERE id = ?", org_id)
    if not org:
        raise HTTPException(404, "Not found")
    paid = await record_payment(
        s,
        description=f"MathMe Campus licence, 1 year: {org['name']}",
        base=plans.price("campus", "annual"),
        buyer_state=org["billing_state"],
        provider="manual",
        provider_ref=body.reference,
        billing_name=org["name"],
        billing_email=org["billing_email"],
        billing_gstin=org["billing_gstin"],
        org_id=org_id,
    )
    if paid is None:
        raise HTTPException(400, "That payment reference was already recorded.")
    await s.db.run("UPDATE orgs SET status = 'paid' WHERE id = ?", org_id)
    return paid


class LinkRequest(BaseModel):
    contactName: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=10, max_length=15)


@router.post("/api/admin/orgs/{org_id}/payment-link")
async def payment_link(request: Request, org_id: str, body: LinkRequest):
    """A Cashfree payment link for the licence fee (+ GST), emailed by Cashfree to the billing contact."""
    s = services(request)
    org = await s.db.one("SELECT * FROM orgs WHERE id = ?", org_id)
    if not org or not org["billing_email"] or not org["billing_state"]:
        raise HTTPException(400, "Add the billing email and state to the licence first.")
    ref = f"lnk_{org_id}__{secrets.token_hex(4)}"
    total = add_gst(plans.price("campus", "annual"), s.settings.seller_state, org["billing_state"]).total
    if s.settings.fake_payments:
        return {"url": f"/api/billing/fake/{ref}", "amount": total}
    if s.settings.payments != "cashfree":
        raise HTTPException(503, 'Payments are not switched on (set PAYMENTS = "cashfree").')
    try:
        url = await s.cashfree.create_link(
            ref=ref,
            amount=total,
            purpose=f"MathMe Campus licence: {org['name']}"[:500],
            customer={"name": body.contactName, "email": org["billing_email"], "phone": body.phone[-10:]},
            notify_url=f"{s.settings.public_url}/api/billing/webhook/cashfree",
            return_url=f"{s.settings.public_url}/?campus=paid",
        )
    except PaymentError as err:
        raise HTTPException(502, f"The payment provider said: {err}") from err
    return {"url": url, "amount": total}


@router.get("/api/admin/payments")
async def payments(request: Request):
    s = services(request)
    rows = await s.db.all(
        """SELECT p.*, i.number, i.id AS invoice_id, COALESCE(u.email, o.name) AS who FROM payments p
           LEFT JOIN invoices i ON i.payment_id = p.id LEFT JOIN users u ON u.id = p.user_id
           LEFT JOIN orgs o ON o.id = p.org_id ORDER BY p.paid_at DESC LIMIT 100"""
    )
    return {"payments": rows}


@router.post("/api/admin/run-daily")
async def run_daily(request: Request):
    return await jobs.daily(services(request))


@router.get("/api/admin/users")
async def users(request: Request, q: str = ""):
    s = services(request)
    like = f"%{q.strip()}%"
    rows = await s.db.all(
        """SELECT id, email, name, role, created_at, last_seen_at FROM users
           WHERE email LIKE ? OR name LIKE ? ORDER BY created_at DESC LIMIT 100""",
        like,
        like,
    )
    return {"users": rows, "since": s.now() - 30 * DAY}
