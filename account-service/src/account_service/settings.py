"""Settings, read from environment variables (or the Worker's `env` bindings)."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlsplit


def _flag(value: Any, default: bool = False) -> bool:
    if value is None or value == "":
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    public_url: str = "http://localhost:5173"
    google_client_id: str = ""
    google_client_secret: str = ""
    owner_emails: frozenset[str] = field(default_factory=frozenset)
    cookie_secure: bool = True
    auth_test_login: bool = False
    payments: str = "fake"  # cashfree | fake
    cashfree_env: str = "sandbox"  # sandbox | production
    cashfree_client_id: str = ""
    cashfree_client_secret: str = ""
    cashfree_webhook_secret: str = ""
    cashfree_api_version: str = "2025-01-01"
    email: str = "console"  # resend | console
    resend_api_key: str = ""
    email_from: str = "MathMe <hello@mathme.app>"
    geometry_origin: str = "http://localhost:8000"
    geometry_secret: str = ""
    seller_name: str = "Al-Majeed School of Research Methodology and Innovation"
    seller_address: str = ""
    seller_state: str = "Karnataka"
    seller_gstin: str = ""
    support_email: str = "support@mathme.app"
    db_path: str = "mathme-accounts.sqlite3"
    bucket_dir: str = "mathme-bucket"

    @property
    def is_local(self) -> bool:
        """Running on a developer's machine or in tests. Test sign-in and fake payments only work here, so a
        production deploy with a forgotten setting can never hand out free plans or owner access."""
        host = urlsplit(self.public_url).hostname or ""
        return host in {"localhost", "127.0.0.1", "testserver"} or host.endswith(".localhost")

    @property
    def test_login(self) -> bool:
        return self.auth_test_login and self.is_local

    @property
    def fake_payments(self) -> bool:
        return self.payments != "cashfree" and self.is_local

    @property
    def cashfree_base(self) -> str:
        return "https://api.cashfree.com/pg" if self.cashfree_env == "production" else "https://sandbox.cashfree.com/pg"

    @classmethod
    def from_env(cls, env: Mapping[str, Any]) -> Settings:
        def get(name: str, default: str = "") -> str:
            v = env.get(name) if hasattr(env, "get") else getattr(env, name, None)
            return default if v is None else str(v)

        owners = frozenset(e.strip().lower() for e in get("OWNER_EMAILS").split(",") if e.strip())
        return cls(
            public_url=get("PUBLIC_URL", cls.public_url).rstrip("/"),
            google_client_id=get("GOOGLE_CLIENT_ID"),
            google_client_secret=get("GOOGLE_CLIENT_SECRET"),
            owner_emails=owners,
            cookie_secure=_flag(get("COOKIE_SECURE"), default=True),
            auth_test_login=_flag(get("AUTH_TEST_LOGIN")),
            payments=get("PAYMENTS", "fake"),
            cashfree_env=get("CASHFREE_ENV", "sandbox"),
            cashfree_client_id=get("CASHFREE_CLIENT_ID"),
            cashfree_client_secret=get("CASHFREE_CLIENT_SECRET"),
            cashfree_webhook_secret=get("CASHFREE_WEBHOOK_SECRET") or get("CASHFREE_CLIENT_SECRET"),
            cashfree_api_version=get("CASHFREE_API_VERSION", cls.cashfree_api_version),
            email=get("EMAIL", "console"),
            resend_api_key=get("RESEND_API_KEY"),
            email_from=get("EMAIL_FROM", cls.email_from),
            geometry_origin=get("GEOMETRY_ORIGIN", cls.geometry_origin).rstrip("/"),
            geometry_secret=get("GEOMETRY_SECRET"),
            seller_name=get("SELLER_NAME", cls.seller_name),
            seller_address=get("SELLER_ADDRESS"),
            seller_state=get("SELLER_STATE", cls.seller_state),
            seller_gstin=get("SELLER_GSTIN"),
            support_email=get("SUPPORT_EMAIL", cls.support_email),
            db_path=get("DB_PATH", cls.db_path),
            bucket_dir=get("BUCKET_DIR", cls.bucket_dir),
        )
