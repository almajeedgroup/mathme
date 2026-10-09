from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_secret_guards_everything_but_health(monkeypatch) -> None:
    from app import main
    from app.settings import Settings

    monkeypatch.setattr(main, "settings", Settings(geometry_secret="s3cret"))
    assert client.get("/health").status_code == 200
    assert client.post("/assist", json={"message": "hi"}).status_code == 401
    wrong = client.post("/assist", json={"message": "hi"}, headers={"X-Geometry-Secret": "nope"})
    assert wrong.status_code == 401
    right = client.post("/assist", json={"message": "hi"}, headers={"X-Geometry-Secret": "s3cret"})
    assert right.status_code != 401
