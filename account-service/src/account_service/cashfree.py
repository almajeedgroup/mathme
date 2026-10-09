"""Cashfree Payments: monthly subscriptions (UPI AutoPay, card, eNACH mandates), one-time orders for
annual plans, payment links for Campus licences, and signed webhooks.

API version 2025-01-01. Field names follow Cashfree's documentation; check them against the sandbox
before going live (see docs/DEPLOY.md). The fake provider produces the same webhook shapes, so the
whole flow can be tested without a Cashfree account.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
from dataclasses import dataclass
from typing import Any

from .gst import rupees
from .http import Http, HttpResponse, post_json
from .settings import Settings

REPLAY_WINDOW_S = 300


class PaymentError(Exception):
    pass


def sign(secret: str, timestamp: str, raw_body: bytes) -> str:
    """Cashfree's webhook signature: Base64(HMAC-SHA256(secret, timestamp + raw body))."""
    mac = hmac.new(secret.encode(), timestamp.encode() + raw_body, hashlib.sha256).digest()
    return base64.b64encode(mac).decode()


def verify(secret: str, timestamp: str | None, signature: str | None, raw_body: bytes, now: int) -> bool:
    if not secret or not timestamp or not signature:
        return False
    try:
        ts = int(timestamp)
    except ValueError:
        return False
    # Cashfree sends milliseconds; accept seconds too
    ts_s = ts // 1000 if ts > 10_000_000_000 else ts
    if abs(now - ts_s) > REPLAY_WINDOW_S:
        return False
    return hmac.compare_digest(sign(secret, timestamp, raw_body), signature)


@dataclass
class Event:
    """What a webhook means for MathMe, whatever its exact Cashfree shape."""

    id: str
    kind: str  # payment | status
    ref: str  # our subscription id, order id or link id
    payment_ref: str = ""
    amount: int = 0  # paise
    status: str = ""  # SUCCESS / FAILED / ACTIVE / CANCELLED / ON_HOLD / PAID …


def _paise(value: Any) -> int:
    try:
        return round(float(value) * 100)
    except (TypeError, ValueError):
        return 0


def parse_event(payload: dict[str, Any]) -> Event | None:
    """Turn a Cashfree webhook body into an Event (None for events MathMe ignores)."""
    etype = str(payload.get("type", ""))
    data = payload.get("data") or {}
    event_time = str(payload.get("event_time", ""))
    if etype.startswith("SUBSCRIPTION_PAYMENT") or etype == "SUBSCRIPTION_PAYMENT_NOTIFICATION":
        ref = str(data.get("subscription_id", ""))
        pay_ref = str(data.get("cf_payment_id") or data.get("payment_id") or "")
        status = str(data.get("payment_status") or etype.rsplit("_", 1)[-1])
        return Event(
            f"{etype}:{ref}:{pay_ref}:{status}", "payment", ref, pay_ref, _paise(data.get("payment_amount")), status
        )
    if etype == "SUBSCRIPTION_AUTH_STATUS":
        details = data.get("authorization_details") or data
        ref = str(data.get("subscription_id") or details.get("subscription_id") or "")
        status = str(details.get("authorization_status") or data.get("authorization_status") or "")
        return Event(f"{etype}:{ref}:{status}", "status", ref, status=status)
    if etype == "SUBSCRIPTION_STATUS_CHANGED":
        details = data.get("subscription_details") or data
        ref = str(details.get("subscription_id", ""))
        status = str(details.get("subscription_status", ""))
        return Event(f"{etype}:{ref}:{status}:{event_time}", "status", ref, status=status)
    if etype.startswith("PAYMENT_SUCCESS") or etype.startswith("PAYMENT_FAILED"):
        order = data.get("order") or {}
        payment = data.get("payment") or {}
        ref = str(order.get("order_id", ""))
        pay_ref = str(payment.get("cf_payment_id", ""))
        status = str(payment.get("payment_status", "SUCCESS" if "SUCCESS" in etype else "FAILED"))
        return Event(
            f"{etype}:{ref}:{pay_ref}",
            "payment",
            ref,
            pay_ref,
            _paise(payment.get("payment_amount") or order.get("order_amount")),
            status,
        )
    if etype == "PAYMENT_LINK_EVENT":
        ref = str(data.get("link_id", ""))
        status = str(data.get("link_status", ""))
        return Event(
            f"{etype}:{ref}:{status}",
            "payment",
            ref,
            ref,
            _paise(data.get("link_amount_paid") or data.get("link_amount")),
            "SUCCESS" if status == "PAID" else status,
        )
    return None


class Cashfree:
    def __init__(self, settings: Settings, http: Http) -> None:
        self.s = settings
        self.http = http

    def _headers(self) -> dict[str, str]:
        return {
            "x-api-version": self.s.cashfree_api_version,
            "x-client-id": self.s.cashfree_client_id,
            "x-client-secret": self.s.cashfree_client_secret,
        }

    async def _post(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        r: HttpResponse = await post_json(self.http, f"{self.s.cashfree_base}{path}", body, self._headers())
        data = r.json() if r.body else {}
        if r.status >= 300:
            raise PaymentError(str((data or {}).get("message") or f"Cashfree error {r.status}"))
        return data

    async def create_subscription(
        self,
        *,
        ref: str,
        plan_label: str,
        amount: int,
        customer: dict[str, str],
        return_url: str,
        first_charge_iso: str,
    ) -> dict[str, Any]:
        """A monthly mandate for `amount` paise (GST included). Returns the subscription session id."""
        body = {
            "subscription_id": ref,
            "customer_details": {
                "customer_name": customer["name"],
                "customer_email": customer["email"],
                "customer_phone": customer["phone"],
            },
            "plan_details": {
                "plan_name": plan_label,
                "plan_type": "PERIODIC",
                "plan_currency": "INR",
                "plan_amount": float(rupees(amount)),
                "plan_max_amount": float(rupees(amount)),
                "plan_max_cycles": 120,
                "plan_intervals": 1,
                "plan_interval_type": "MONTH",
            },
            # the first month is paid when the mandate is authorised (UPI AutoPay needs 24 hours'
            # notice before each later debit), so the first scheduled charge is a month later
            "authorization_details": {
                "authorization_amount": float(rupees(amount)),
                "authorization_amount_refund": False,
                "payment_methods": ["upi", "card", "enach"],
            },
            "subscription_meta": {"return_url": return_url},
            "subscription_first_charge_time": first_charge_iso,
        }
        data = await self._post("/subscriptions", body)
        return {"sessionId": data.get("subscription_session_id"), "providerId": data.get("cf_subscription_id")}

    async def cancel_subscription(self, ref: str) -> None:
        await self._post(f"/subscriptions/{ref}/manage", {"subscription_id": ref, "action": "CANCEL"})

    async def create_order(
        self, *, ref: str, amount: int, customer: dict[str, str], return_url: str, notify_url: str
    ) -> dict[str, Any]:
        body = {
            "order_id": ref,
            "order_amount": float(rupees(amount)),
            "order_currency": "INR",
            "customer_details": {
                "customer_id": customer["id"],
                "customer_name": customer["name"],
                "customer_email": customer["email"],
                "customer_phone": customer["phone"],
            },
            "order_meta": {"return_url": return_url, "notify_url": notify_url},
        }
        data = await self._post("/orders", body)
        return {"sessionId": data.get("payment_session_id")}

    async def create_link(
        self, *, ref: str, amount: int, purpose: str, customer: dict[str, str], notify_url: str, return_url: str
    ) -> str:
        body = {
            "link_id": ref,
            "link_amount": float(rupees(amount)),
            "link_currency": "INR",
            "link_purpose": purpose,
            "customer_details": {
                "customer_name": customer["name"],
                "customer_email": customer["email"],
                "customer_phone": customer["phone"],
            },
            "link_notify": {"send_email": True},
            "link_meta": {"notify_url": notify_url, "return_url": return_url},
        }
        data = await self._post("/links", body)
        return str(data.get("link_url", ""))


def fake_event(kind: str, ref: str, amount: int, payment_ref: str, now: int) -> bytes:
    """A webhook body in Cashfree's shape, for the fake checkout used in development and tests."""
    if kind == "subscription":
        payload = {
            "type": "SUBSCRIPTION_PAYMENT_SUCCESS",
            "event_time": str(now),
            "data": {
                "subscription_id": ref,
                "cf_payment_id": payment_ref,
                "payment_amount": float(rupees(amount)),
                "payment_status": "SUCCESS",
            },
        }
    elif kind == "link":
        payload = {
            "type": "PAYMENT_LINK_EVENT",
            "event_time": str(now),
            "data": {"link_id": ref, "link_status": "PAID", "link_amount_paid": float(rupees(amount))},
        }
    else:
        payload = {
            "type": "PAYMENT_SUCCESS_WEBHOOK",
            "event_time": str(now),
            "data": {
                "order": {"order_id": ref, "order_amount": float(rupees(amount))},
                "payment": {
                    "cf_payment_id": payment_ref,
                    "payment_status": "SUCCESS",
                    "payment_amount": float(rupees(amount)),
                },
            },
        }
    return json.dumps(payload).encode()
