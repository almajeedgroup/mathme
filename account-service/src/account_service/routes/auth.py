"""Sign in with Google (authorisation-code flow; tokens never reach the browser), sign out, who am I."""

from __future__ import annotations

import secrets
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, Field

from .. import plans
from ..core import (
    SESSION_COOKIE,
    active_subscription,
    create_session,
    current_user,
    membership,
    new_id,
    org_active,
    plan_in_force,
    public_user,
    require_csrf,
    services,
    session_cookie,
    token_hash,
    usage_count,
)
from ..http import post_form
from ..services import Services

router = APIRouter()

GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO = "https://openidconnect.googleapis.com/v1/userinfo"


def _safe_return(path: str | None) -> str:
    """Only send people back inside MathMe (no open redirects)."""
    if not path or not path.startswith("/") or path.startswith("//") or "\\" in path or any(c < " " for c in path):
        return "/"  # browsers read "/\\evil.com" as "//evil.com"
    return path


STATE_COOKIE = "mm_oauth_state"


def _state_cookie(s: Services, state: str, max_age: int) -> str:
    """Ties the Google round trip to this browser, so nobody can sign you in to their account (login CSRF)."""
    secure = "; Secure" if s.settings.cookie_secure else ""
    return f"{STATE_COOKIE}={state}; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age={max_age}{secure}"


async def upsert_user(s: Services, *, sub: str, email: str, name: str, avatar: str) -> dict:
    now = s.now()
    role = "owner" if email.lower() in s.settings.owner_emails else "user"
    user = await s.db.one("SELECT * FROM users WHERE google_sub = ?", sub)
    if user:
        await s.db.run(
            "UPDATE users SET email = ?, name = ?, avatar = ?, role = ?, last_seen_at = ? WHERE id = ?",
            email, name, avatar, role, now, user["id"],
        )  # fmt: skip
    else:
        await s.db.run(
            """INSERT INTO users (id, google_sub, email, name, avatar, role, created_at, last_seen_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            new_id("usr"), sub, email, name, avatar, role, now, now,
        )  # fmt: skip
    return await s.db.one("SELECT * FROM users WHERE google_sub = ?", sub)  # type: ignore[return-value]


@router.get("/api/auth/google/start")
async def google_start(request: Request, ret: str = "/"):
    s = services(request)
    if not s.settings.google_client_id:
        raise HTTPException(503, "Google sign-in is not set up on this server yet.")
    state = secrets.token_urlsafe(24)
    await s.db.run("DELETE FROM oauth_states WHERE expires_at < ?", s.now())
    await s.db.run(
        "INSERT INTO oauth_states (state, return_to, expires_at) VALUES (?, ?, ?)",
        state,
        _safe_return(ret),
        s.now() + 600,
    )
    query = urlencode(
        {
            "client_id": s.settings.google_client_id,
            "redirect_uri": f"{s.settings.public_url}/api/auth/google/callback",
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "prompt": "select_account",
        }
    )
    resp = RedirectResponse(f"{GOOGLE_AUTH}?{query}", status_code=302)
    resp.headers["Set-Cookie"] = _state_cookie(s, state, 600)
    return resp


@router.get("/api/auth/google/callback")
async def google_callback(request: Request, code: str = "", state: str = "", error: str = ""):
    s = services(request)
    row = await s.db.one("SELECT * FROM oauth_states WHERE state = ? AND expires_at > ?", state, s.now())
    await s.db.run("DELETE FROM oauth_states WHERE state = ?", state)
    same_browser = secrets.compare_digest(request.cookies.get(STATE_COOKIE, ""), state)
    if error or not code or not row or not state or not same_browser:
        return RedirectResponse("/?signin=failed", status_code=302)
    token = await post_form(
        s.http,
        GOOGLE_TOKEN,
        {
            "code": code,
            "client_id": s.settings.google_client_id,
            "client_secret": s.settings.google_client_secret,
            "redirect_uri": f"{s.settings.public_url}/api/auth/google/callback",
            "grant_type": "authorization_code",
        },
    )
    access = (token.json() or {}).get("access_token") if token.status == 200 else None
    if not access:
        return RedirectResponse("/?signin=failed", status_code=302)
    info_resp = await s.http.request("GET", GOOGLE_USERINFO, headers={"Authorization": f"Bearer {access}"})
    info = info_resp.json() if info_resp.status == 200 else {}
    if not info.get("sub") or not info.get("email") or not info.get("email_verified"):
        return RedirectResponse("/?signin=failed", status_code=302)
    user = await upsert_user(
        s,
        sub=str(info["sub"]),
        email=str(info["email"]),
        name=str(info.get("name", "")),
        avatar=str(info.get("picture", "")),
    )
    session = await create_session(s, user["id"])
    resp = RedirectResponse(row["return_to"], status_code=302)
    resp.headers.append("Set-Cookie", session_cookie(s, session))
    resp.headers.append("Set-Cookie", _state_cookie(s, "", 0))
    return resp


class TestLogin(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    name: str = Field(default="Test user", max_length=200)


@router.post("/api/auth/test-login", dependencies=[Depends(require_csrf)])
async def test_login(request: Request, body: TestLogin):
    """Development and automated tests only: sign in without Google. Off unless AUTH_TEST_LOGIN=1."""
    s = services(request)
    if not s.settings.test_login:  # AUTH_TEST_LOGIN=1, and only on localhost
        raise HTTPException(404, "Not found")
    user = await upsert_user(s, sub=f"test:{body.email}", email=body.email, name=body.name, avatar="")
    session = await create_session(s, user["id"])
    resp = JSONResponse({"user": public_user(user)})
    resp.headers["Set-Cookie"] = session_cookie(s, session)
    return resp


@router.post("/api/auth/logout", dependencies=[Depends(require_csrf)])
async def logout(request: Request):
    s = services(request)
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        await s.db.run("DELETE FROM sessions WHERE token_hash = ?", token_hash(token))
    resp = JSONResponse({"ok": True})
    resp.headers["Set-Cookie"] = session_cookie(s, "", max_age=0)
    return resp


@router.get("/api/me")
async def me(request: Request):
    """Who is signed in, the plan in force, its limits, and what has been used this day / month."""
    s = services(request)
    user = await current_user(request)
    signin = bool(s.settings.google_client_id) or s.settings.test_login
    if not user:
        return {"user": None, "signinAvailable": signin, **(await plan_in_force(s, None))}
    now = s.now()
    if now - int(user["last_seen_at"]) > 300:
        await s.db.run("UPDATE users SET last_seen_at = ? WHERE id = ?", now, user["id"])
    force = await plan_in_force(s, user)
    sub = await active_subscription(s, user["id"])
    org = await membership(s, user["id"])
    projects = await s.db.one("SELECT COUNT(*) AS n FROM projects WHERE owner_id = ?", user["id"])
    return {
        "user": public_user(user),
        "signinAvailable": signin,
        **force,
        "usage": {
            "exports": await usage_count(s, user["id"], "export"),
            "geometry": await usage_count(s, user["id"], "geometry"),
            "ai": await usage_count(s, user["id"], "ai"),
            "cloudProjects": int(projects["n"]) if projects else 0,
        },
        "subscription": sub
        and {
            "plan": sub["plan"],
            "period": sub["period"],
            "status": sub["status"],
            "currentPeriodEnd": sub["current_period_end"],
            "cancelAtPeriodEnd": bool(sub["cancel_at_period_end"]),
        },
        "campus": org
        and {
            "orgId": org["id"],
            "name": org["name"],
            "role": org["role"],
            "active": org_active(org, now),
            "endsAt": org["ends_at"],
            "plan": plans.campus_plan(org["role"]),
        },
    }
