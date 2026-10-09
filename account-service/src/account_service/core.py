"""Shared helpers: ids, sessions, the signed-in user, plans in force, usage counters, invoices."""

from __future__ import annotations

import calendar
import datetime as dt
import hashlib
import json
import secrets
from typing import Any

from fastapi import HTTPException, Request

from . import plans
from .gst import add_gst, financial_year
from .services import Services

SESSION_COOKIE = "mm_session"
SESSION_DAYS = 30
DAY = 86_400


def new_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_hex(8)}"


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def services(request: Request) -> Services:
    """The services for this request: the Worker's env bindings in Cloudflare, the app's otherwise."""
    env = request.scope.get("env")
    if env is not None:  # pragma: no cover - Workers runtime
        from .services import worker_services

        return worker_services(env)
    return request.app.state.services


def add_months(ts: int, months: int) -> int:
    d = dt.datetime.fromtimestamp(ts, dt.UTC)
    m = d.month - 1 + months
    year = d.year + m // 12
    month = m % 12 + 1
    day = min(d.day, calendar.monthrange(year, month)[1])
    return int(d.replace(year=year, month=month, day=day).timestamp())


# ---------------------------------------------------------------- sessions


async def create_session(s: Services, user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    now = s.now()
    await s.db.run(
        "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
        token_hash(token),
        user_id,
        now,
        now + SESSION_DAYS * DAY,
    )
    return token


def session_cookie(s: Services, token: str, max_age: int = SESSION_DAYS * DAY) -> str:
    secure = "; Secure" if s.settings.cookie_secure else ""
    return f"{SESSION_COOKIE}={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age={max_age}{secure}"


async def current_user(request: Request) -> dict | None:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return None
    s = services(request)
    row = await s.db.one(
        "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?",
        token_hash(token),
        s.now(),
    )
    return row


async def require_user(request: Request) -> dict:
    user = await current_user(request)
    if not user:
        raise HTTPException(401, "Please sign in first.")
    return user


async def require_owner(request: Request) -> dict:
    user = await require_user(request)
    if user["role"] != "owner":
        raise HTTPException(403, "Only the MathMe owner can open this.")
    return user


def require_csrf(request: Request) -> None:
    """Requests that change data must come from the app (a custom header other sites cannot send)."""
    if request.method in {"POST", "PUT", "PATCH", "DELETE"} and request.headers.get("x-mathme") != "1":
        raise HTTPException(403, "Missing the X-MathMe header.")


# ---------------------------------------------------------------- plans in force


async def active_subscription(s: Services, user_id: str) -> dict | None:
    """The paid subscription giving access right now (cancelled ones keep access to the end of the period)."""
    return await s.db.one(
        """SELECT * FROM subscriptions
           WHERE user_id = ? AND status IN ('active', 'past_due', 'cancelled')
             AND current_period_end > ?
           ORDER BY CASE plan WHEN 'pro' THEN 0 ELSE 1 END, current_period_end DESC LIMIT 1""",
        user_id,
        s.now(),
    )


async def membership(s: Services, user_id: str) -> dict | None:
    return await s.db.one(
        """SELECT m.role, o.* FROM org_members m JOIN orgs o ON o.id = m.org_id
           WHERE m.user_id = ? ORDER BY o.ends_at DESC LIMIT 1""",
        user_id,
    )


def org_active(org: dict | None, now: int) -> bool:
    return bool(org) and org["status"] in ("pilot", "paid") and org["starts_at"] <= now < org["ends_at"]


async def plan_in_force(s: Services, user: dict | None) -> dict[str, Any]:
    """{plan, source, limits}: the best of the user's own subscription and their Campus licence."""
    if not user:
        return {"plan": "free", "source": "free", "limits": plans.limits("free")}
    best, source = "free", "free"
    sub = await active_subscription(s, user["id"])
    if sub:
        best, source = sub["plan"], "subscription"
    org = await membership(s, user["id"])
    if org_active(org, s.now()):
        campus = plans.campus_plan(org["role"])
        if plans.higher(campus, best) == campus and campus != best:
            best, source = campus, "campus"
    return {"plan": best, "source": source, "limits": plans.limits(best)}


# ---------------------------------------------------------------- usage


def period_key(kind: str, now: int) -> str:
    d = dt.datetime.fromtimestamp(now, dt.UTC)
    return d.strftime("%Y-%m") if kind == "export" else d.strftime("%Y-%m-%d")


async def usage_count(s: Services, user_id: str, kind: str) -> int:
    row = await s.db.one(
        "SELECT count FROM usage WHERE user_id = ? AND kind = ? AND period = ?",
        user_id,
        kind,
        period_key(kind, s.now()),
    )
    return int(row["count"]) if row else 0


async def use(s: Services, user_id: str, kind: str, limit: int) -> tuple[bool, int]:
    """Count one use if it fits the limit. Returns (allowed, used so far including this one)."""
    period = period_key(kind, s.now())
    row = await s.db.one(
        """INSERT INTO usage (user_id, kind, period, count) VALUES (?, ?, ?, 1)
           ON CONFLICT (user_id, kind, period) DO UPDATE SET count = count + 1
           RETURNING count""",
        user_id,
        kind,
        period,
    )
    used = int(row["count"]) if row else 1
    if limit != plans.UNLIMITED and used > limit:
        await s.db.run(
            "UPDATE usage SET count = count - 1 WHERE user_id = ? AND kind = ? AND period = ?", user_id, kind, period
        )
        return False, used - 1
    return True, used


# ---------------------------------------------------------------- money


async def next_counter(s: Services, name: str) -> int:
    row = await s.db.one(
        """INSERT INTO counters (name, value) VALUES (?, 1)
           ON CONFLICT (name) DO UPDATE SET value = value + 1 RETURNING value""",
        name,
    )
    return int(row["value"])


async def record_payment(
    s: Services,
    *,
    description: str,
    base: int,
    buyer_state: str,
    provider: str,
    provider_ref: str,
    billing_name: str,
    billing_email: str,
    billing_gstin: str = "",
    user_id: str | None = None,
    org_id: str | None = None,
    subscription_id: str | None = None,
) -> dict | None:
    """Store a paid payment and issue its GST invoice. Returns None if this payment was already recorded."""
    existing = await s.db.one("SELECT id FROM payments WHERE provider = ? AND provider_ref = ?", provider, provider_ref)
    if existing:
        return None
    tax = add_gst(base, s.settings.seller_state, buyer_state or s.settings.seller_state)
    pid = new_id("pay")
    now = s.now()
    await s.db.run(
        """INSERT INTO payments (id, user_id, org_id, subscription_id, description, base, cgst, sgst, igst,
           total, status, provider, provider_ref, paid_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?, ?)""",
        pid, user_id, org_id, subscription_id, description, tax.base, tax.cgst, tax.sgst, tax.igst, tax.total,
        provider, provider_ref, now,
    )  # fmt: skip
    fy = financial_year(now)
    number = f"MM/{fy}/{await next_counter(s, f'invoice:{fy}'):06d}"
    lines = [{"description": description, "sac": "997331", "amount": tax.base}]
    iid = new_id("inv")
    await s.db.run(
        """INSERT INTO invoices (id, number, payment_id, user_id, org_id, billing_name, billing_email,
           billing_state, billing_gstin, lines, issued_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        iid, number, pid, user_id, org_id, billing_name, billing_email, buyer_state, billing_gstin,
        json.dumps(lines), now,
    )  # fmt: skip
    return {"payment_id": pid, "invoice_id": iid, "number": number, **tax.dict()}


def public_user(user: dict) -> dict:
    return {k: user[k] for k in ("id", "email", "name", "avatar", "role")}
