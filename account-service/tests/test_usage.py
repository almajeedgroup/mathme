from account_service.core import DAY

from .conftest import sign_in


def test_export_formats_follow_the_plan(client, signed_in):
    assert client.post("/api/usage/export", json={"format": "png-hd"}).status_code == 200
    stl = client.post("/api/usage/export", json={"format": "stl"})
    assert stl.status_code == 402
    assert "STL" in stl.json()["detail"]
    assert client.post("/api/usage/export", json={"format": "nope"}).status_code == 400


def test_monthly_export_allowance(client, signed_in, clock):
    for _ in range(14):
        assert client.post("/api/usage/export", json={"format": "project"}).status_code == 200
    last = client.post("/api/usage/export", json={"format": "project"}).json()
    assert last["used"] == 15 and last["limit"] == 15
    blocked = client.post("/api/usage/export", json={"format": "project"})
    assert blocked.status_code == 402
    assert client.get("/api/me").json()["usage"]["exports"] == 15  # a refused export is not counted
    clock.t += 22 * DAY  # 1 November: a new month
    assert client.post("/api/usage/export", json={"format": "project"}).status_code == 200


def test_geometry_jobs_go_through_with_the_secret_and_a_daily_quota(client, http, clock):
    http.on("POST", "http://geometry/analyze", body={"volume": 1})
    assert client.post("/api/analyze", content=b"x").status_code == 401  # signed out
    sign_in(client)
    for _ in range(5):
        r = client.post("/api/analyze", content=b"mesh", headers={"content-type": "application/octet-stream"})
        assert r.status_code == 200
        assert r.json() == {"volume": 1}
    method, url, headers, body = http.calls[-1]
    assert (method, url, body) == ("POST", "http://geometry/analyze", b"mesh")
    assert headers["X-Geometry-Secret"] == "geo-secret"
    assert "X-Priority" not in headers
    sixth = client.post("/api/analyze", content=b"mesh")
    assert sixth.status_code == 402
    assert "5 geometry jobs" in sixth.json()["detail"]
    clock.t += DAY
    assert client.post("/api/analyze", content=b"mesh").status_code == 200


def test_ai_chat_has_its_own_quota(client, http):
    http.on("POST", "http://geometry/assist", body={"reply": "hi", "commands": [], "idea": None, "name": None})
    sign_in(client)
    for _ in range(5):
        assert client.post("/api/assist", json={"message": "spiral"}).status_code == 200
    assert client.post("/api/assist", json={"message": "spiral"}).status_code == 402
    # geometry jobs are counted separately
    http.on("POST", "http://geometry/boolean", body={})
    assert client.post("/api/boolean", content=b"x").status_code == 200


def test_health_passes_through_and_unknown_routes_404(client, http):
    http.on("GET", "http://geometry/health", body={"status": "ok", "assistant": True})
    assert client.get("/api/health").json()["assistant"] is True
    sign_in(client)
    assert client.post("/api/whatever").status_code == 404


def test_geometry_down_is_a_clear_error(client, svc):
    class Broken:
        async def request(self, *a, **k):
            raise OSError("down")

    svc.http = Broken()
    sign_in(client)
    r = client.post("/api/analyze", content=b"x")
    assert r.status_code == 502
