from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from account_service.app import create_app
from account_service.db import SqliteDb
from account_service.http import HttpResponse
from account_service.services import Services
from account_service.settings import Settings
from account_service.storage import LocalBucket

T0 = 1_791_590_400  # 2026-10-10 00:00 UTC


class FakeHttp:
    """Records outgoing calls and answers from a table of (method, url-prefix) → response."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, str, dict, bytes | None]] = []
        self.routes: list[tuple[str, str, HttpResponse]] = []

    def on(self, method: str, prefix: str, status: int = 200, body=None, headers=None) -> None:
        raw = body if isinstance(body, bytes) else json.dumps(body if body is not None else {}).encode()
        self.routes.insert(
            0, (method, prefix, HttpResponse(status, raw, headers or {"content-type": "application/json"}))
        )

    async def request(self, method, url, *, headers=None, body=None) -> HttpResponse:
        self.calls.append((method, url, headers or {}, body))
        for m, prefix, resp in self.routes:
            if m == method and url.startswith(prefix):
                return resp
        return HttpResponse(404, b'{"message": "no fake route"}', {})


class Clock:
    def __init__(self) -> None:
        self.t = T0

    def __call__(self) -> int:
        return self.t


@pytest.fixture
def clock() -> Clock:
    return Clock()


@pytest.fixture
def http() -> FakeHttp:
    return FakeHttp()


def make_settings(**over) -> Settings:
    base = dict(
        public_url="http://testserver",
        google_client_id="gid",
        google_client_secret="gsecret",
        owner_emails=frozenset({"owner@mathme.app"}),
        cookie_secure=False,
        auth_test_login=True,
        payments="fake",
        cashfree_webhook_secret="whsec",
        seller_state="Karnataka",
        seller_gstin="29ABCDE1234F1Z5",
        geometry_origin="http://geometry",
        geometry_secret="geo-secret",
    )
    base.update(over)
    return Settings(**base)


@pytest.fixture
def svc(tmp_path, http, clock) -> Services:
    db = SqliteDb(":memory:")
    db.migrate()
    return Services(make_settings(), db, LocalBucket(tmp_path / "bucket"), http, clock=clock)


@pytest.fixture
def client(svc) -> TestClient:
    c = TestClient(create_app(svc))
    c.headers["X-MathMe"] = "1"
    return c


def sign_in(client: TestClient, email: str = "student@example.com", name: str = "Asha") -> dict:
    r = client.post("/api/auth/test-login", json={"email": email, "name": name})
    assert r.status_code == 200, r.text
    return r.json()["user"]


@pytest.fixture
def signed_in(client) -> dict:
    return sign_in(client)
