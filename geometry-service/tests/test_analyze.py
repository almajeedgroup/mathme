import io

import pytest
import trimesh

from app.main import app as fastapi_app
from tests.conftest import box, glb


def post(client, data: bytes):
    return client.post("/analyze", files={"file": ("model.glb", io.BytesIO(data), "model/gltf-binary")})


def test_box_volume_and_area(client):
    r = post(client, glb(box((2, 3, 4))))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["volume"] == pytest.approx(24)
    assert body["surface_area"] == pytest.approx(52)
    assert body["bounds"]["size"] == pytest.approx([2, 3, 4])
    assert body["is_watertight"] is True
    assert body["bodies"] == 1
    assert body["notes"] == []


def test_overlaps_are_only_counted_once(client):
    r = post(client, glb(box((2, 2, 2)), box((2, 2, 2), at=(1, 0, 0))))
    body = r.json()
    assert body["volume_sum"] == pytest.approx(16)
    assert body["volume"] == pytest.approx(12)
    assert body["overlap_volume"] == pytest.approx(4)


def test_split_corners_from_threejs_are_joined(client):
    # three.js duplicates corners along texture seams; the mesh must still count as closed
    m = box((1, 1, 1))
    m.unmerge_vertices()
    assert len(m.vertices) == 36
    body = post(client, glb(m)).json()
    assert body["solid_parts"] == 1
    assert body["volume"] == pytest.approx(1)


def test_open_sheets_have_no_volume(client):
    sheet = trimesh.Trimesh(
        vertices=[[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], faces=[[0, 1, 2], [0, 2, 3]]
    )
    body = post(client, glb(sheet)).json()
    assert body["open_parts"] == 1
    assert body["volume"] is None
    assert body["surface_area"] == pytest.approx(1)
    assert "open sheets" in body["notes"][0]


def test_separate_pieces_are_reported(client):
    body = post(client, glb(box((1, 1, 1)), box((1, 1, 1), at=(5, 0, 0)))).json()
    assert body["bodies"] == 2
    assert any("2 separate pieces" in n for n in body["notes"])


def test_bad_file(client):
    r = post(client, b"this is not a glb")
    assert r.status_code == 422
    assert "not a valid GLB" in r.json()["detail"]


def test_empty_file(client):
    assert post(client, b"").status_code == 422


def test_upload_size_limit(client, monkeypatch):
    from app import main
    from app.settings import Settings

    monkeypatch.setattr(main, "settings", Settings(max_upload_mb=0.0001))
    r = post(client, glb(box()))
    assert r.status_code == 413


def test_triangle_limit(client, monkeypatch):
    from app import main
    from app.settings import Settings

    monkeypatch.setattr(main, "settings", Settings(max_triangles=10))
    r = post(client, glb(box()))
    assert r.status_code == 413
    assert "triangles" in r.json()["detail"]


def test_cors_allows_the_web_app():
    from fastapi.testclient import TestClient

    c = TestClient(fastapi_app)
    r = c.get("/health", headers={"Origin": "http://localhost:5173"})
    assert r.headers["access-control-allow-origin"] == "http://localhost:5173"
    r = c.get("/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in r.headers
