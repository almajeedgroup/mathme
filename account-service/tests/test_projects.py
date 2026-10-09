from .conftest import sign_in

PROJECT = {"app": "mathme-3d-studio", "version": 1, "name": "Spiral", "nodes": []}
THUMB = "data:image/jpeg;base64,/9j/2wBDAAEBAQ=="


def save(client, pid, base=0, **over):
    body = {"name": "Spiral", "objects": 100, "baseVersion": base, "data": PROJECT, **over}
    return client.put(f"/api/projects/{pid}", json=body)


def test_save_list_open_and_delete(client, signed_in):
    r = save(client, "project_a1", thumb=THUMB)
    assert r.status_code == 200, r.text
    assert r.json()["version"] == 1
    listed = client.get("/api/projects").json()
    assert listed["limit"] == 3
    assert [p["id"] for p in listed["projects"]] == ["project_a1"]
    assert listed["projects"][0]["hasThumb"] is True
    got = client.get("/api/projects/project_a1").json()
    assert got["data"] == PROJECT and got["readOnly"] is False
    assert client.get("/api/projects/project_a1/thumb").headers["content-type"] == "image/jpeg"
    assert client.delete("/api/projects/project_a1").status_code == 200
    assert client.get("/api/projects").json()["projects"] == []


def test_versions_catch_edits_from_another_device(client, signed_in):
    save(client, "project_b")
    assert save(client, "project_b", base=1).json()["version"] == 2
    stale = save(client, "project_b", base=1)
    assert stale.status_code == 409
    assert stale.json()["detail"]["version"] == 2
    assert save(client, "project_b", base=1, force=True).json()["version"] == 3


def test_free_plan_keeps_three_projects_in_the_cloud(client, signed_in):
    for i in range(3):
        assert save(client, f"project_{i}").status_code == 200
    fourth = save(client, "project_3")
    assert fourth.status_code == 402
    assert "3 projects" in fourth.json()["detail"]
    assert save(client, "project_0", base=1).status_code == 200  # updating an existing one is fine


def test_project_size_limit(client, signed_in):
    big = {**PROJECT, "blob": "x" * 5_100_000}
    r = save(client, "project_big", data=big)
    assert r.status_code == 402
    assert "MB" in r.json()["detail"]


def test_other_people_cannot_see_or_overwrite(client):
    sign_in(client, "a@example.com")
    save(client, "project_mine")
    sign_in(client, "b@example.com")
    assert client.get("/api/projects/project_mine").status_code == 404
    assert save(client, "project_mine").status_code == 404
    assert client.get("/api/projects").json()["projects"] == []


def test_needs_sign_in_and_safe_ids(client):
    assert client.get("/api/projects").status_code == 401
    sign_in(client)
    assert save(client, "bad id!").status_code == 400


def test_sharing_needs_a_class(client, signed_in):
    save(client, "project_s")
    r = client.post("/api/projects/project_s/share", json={"shared": True})
    assert r.status_code == 400
