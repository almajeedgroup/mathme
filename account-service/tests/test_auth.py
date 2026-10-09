from urllib.parse import parse_qs, urlparse

from account_service.core import SESSION_COOKIE

from .conftest import sign_in


def test_signed_out_me_is_free(client):
    r = client.get("/api/me").json()
    assert r["user"] is None
    assert r["plan"] == "free"
    assert r["limits"]["cloudProjects"] == 3
    assert r["signinAvailable"] is True


def test_google_sign_in_round_trip(client, http, svc):
    start = client.get("/api/auth/google/start", params={"ret": "/#studio"}, follow_redirects=False)
    assert start.status_code == 302
    q = parse_qs(urlparse(start.headers["location"]).query)
    assert q["client_id"] == ["gid"]
    assert q["redirect_uri"] == ["http://testserver/api/auth/google/callback"]
    state = q["state"][0]

    http.on("POST", "https://oauth2.googleapis.com/token", body={"access_token": "tok"})
    http.on(
        "GET",
        "https://openidconnect.googleapis.com/v1/userinfo",
        body={"sub": "g-1", "email": "Owner@MathMe.app", "email_verified": True, "name": "Owner", "picture": "p"},
    )
    cb = client.get("/api/auth/google/callback", params={"code": "c", "state": state}, follow_redirects=False)
    assert cb.status_code == 302
    assert cb.headers["location"] == "/#studio"
    assert SESSION_COOKIE in cb.headers["set-cookie"]
    assert "HttpOnly" in cb.headers["set-cookie"]
    me = client.get("/api/me").json()
    assert me["user"]["email"] == "Owner@MathMe.app"
    assert me["user"]["role"] == "owner"  # OWNER_EMAILS match is not case sensitive
    # the state is single-use
    again = client.get("/api/auth/google/callback", params={"code": "c", "state": state}, follow_redirects=False)
    assert again.headers["location"] == "/?signin=failed"


def test_unverified_google_email_is_refused(client, http):
    state = parse_qs(urlparse(client.get("/api/auth/google/start", follow_redirects=False).headers["location"]).query)[
        "state"
    ][0]
    http.on("POST", "https://oauth2.googleapis.com/token", body={"access_token": "tok"})
    http.on("GET", "https://openidconnect", body={"sub": "g-2", "email": "x@y.z", "email_verified": False})
    cb = client.get("/api/auth/google/callback", params={"code": "c", "state": state}, follow_redirects=False)
    assert cb.headers["location"] == "/?signin=failed"


def test_return_path_cannot_leave_mathme():
    from account_service.routes.auth import _safe_return

    for bad in ["//evil.example", "/\\evil.example", "https://evil.example", "/\tx", "", None]:
        assert _safe_return(bad) == "/", bad
    assert _safe_return("/#studio") == "/#studio"


def test_google_callback_must_come_back_to_the_same_browser(client, http):
    """Login CSRF: a link with someone else's code and state must not sign you in to their account."""
    start = client.get("/api/auth/google/start", follow_redirects=False)
    state = parse_qs(urlparse(start.headers["location"]).query)["state"][0]
    client.cookies.clear()  # the victim's browser never started this sign-in
    http.on("POST", "https://oauth2.googleapis.com/token", body={"access_token": "tok"})
    http.on("GET", "https://openidconnect", body={"sub": "g-3", "email": "a@b.co", "email_verified": True})
    cb = client.get("/api/auth/google/callback", params={"code": "c", "state": state}, follow_redirects=False)
    assert cb.headers["location"] == "/?signin=failed"
    assert client.get("/api/me").json()["user"] is None


def test_changes_need_the_app_header(client):
    client.headers.pop("X-MathMe")
    r = client.post("/api/auth/test-login", json={"email": "a@b.c"})
    assert r.status_code == 403


def test_logout_ends_the_session(client):
    sign_in(client)
    assert client.get("/api/me").json()["user"]
    client.post("/api/auth/logout")
    assert client.get("/api/me").json()["user"] is None


def test_test_login_is_off_unless_enabled(client, svc):
    object.__setattr__(svc.settings, "auth_test_login", False)
    assert client.post("/api/auth/test-login", json={"email": "a@b.c"}).status_code == 404
