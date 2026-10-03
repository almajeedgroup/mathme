import io

import pytest
import trimesh

from tests.conftest import box, glb


def boolean(client, a: bytes, b: bytes, operation: str):
    return client.post(
        "/boolean",
        files={"a": ("a.glb", io.BytesIO(a)), "b": ("b.glb", io.BytesIO(b))},
        data={"operation": operation},
    )


def load(data: bytes) -> trimesh.Trimesh:
    return trimesh.load(io.BytesIO(data), file_type="glb", force="mesh")


@pytest.mark.parametrize(
    ("operation", "volume"),
    [("union", 8 + 8 - 4), ("difference", 8 - 4), ("intersection", 4)],
)
def test_boolean_operations(client, operation, volume):
    a = glb(box((2, 2, 2)))
    b = glb(box((2, 2, 2), at=(1, 0, 0)))
    r = boolean(client, a, b, operation)
    assert r.status_code == 200, r.text
    assert r.headers["content-type"] == "model/gltf-binary"
    result = load(r.content)
    assert result.is_watertight
    assert result.volume == pytest.approx(volume)


def test_cut_a_hole(client):
    plate = glb(box((4, 1, 4)))  # thin in Y
    peg = trimesh.creation.cylinder(radius=0.5, height=3, sections=64)  # along Z…
    peg.apply_transform(trimesh.transformations.rotation_matrix(1.5707963, [1, 0, 0]))  # …turned to Y
    peg = glb(peg)
    result = load(boolean(client, plate, peg, "difference").content)
    assert result.volume == pytest.approx(16 - 3.14159 * 0.25, rel=0.01)


def test_shapes_that_do_not_touch(client):
    r = boolean(client, glb(box((1, 1, 1))), glb(box((1, 1, 1), at=(5, 0, 0))), "intersection")
    assert r.status_code == 422
    assert "don't overlap" in r.json()["detail"]


def test_sheets_cannot_be_combined(client):
    sheet = trimesh.Trimesh(vertices=[[0, 0, 0], [1, 0, 0], [1, 0, 1]], faces=[[0, 1, 2]])
    r = boolean(client, glb(box()), glb(sheet), "union")
    assert r.status_code == 422
    assert "open sheet" in r.json()["detail"]


def test_unknown_operation(client):
    r = boolean(client, glb(box()), glb(box()), "explode")
    assert r.status_code == 422


def export(client, data: bytes, **form):
    return client.post("/export", files={"file": ("m.glb", io.BytesIO(data))}, data=form)


def test_export_stl_in_millimetres(client):
    model = glb(box((2, 2, 2)), box((2, 2, 2), at=(1, 0, 0)))  # 12 cm³ after joining
    r = export(client, model, format="stl", scale="10", name="My Art!")
    assert r.status_code == 200, r.text
    assert r.headers["content-disposition"] == 'attachment; filename="My-Art.stl"'
    data = r.content
    triangles = int.from_bytes(data[80:84], "little")
    assert len(data) == 84 + 50 * triangles
    mesh = trimesh.load(io.BytesIO(data), file_type="stl")
    assert mesh.is_watertight
    assert mesh.volume == pytest.approx(12 * 1000)


@pytest.mark.parametrize("fmt", ["obj", "ply", "3mf"])
def test_other_formats_load_back(client, fmt):
    r = export(client, glb(box((1, 2, 3))), format=fmt)
    assert r.status_code == 200, r.text
    mesh = trimesh.load(io.BytesIO(r.content), file_type=fmt, force="mesh")
    assert mesh.volume == pytest.approx(6)


def test_export_keeps_sheets_and_says_so(client):
    sheet = trimesh.Trimesh(vertices=[[5, 0, 0], [6, 0, 0], [6, 0, 1]], faces=[[0, 1, 2]])
    r = export(client, glb(box(), sheet), format="stl", repair="false")
    assert r.status_code == 200
    assert "open sheet" in r.headers["x-notes"]


def test_export_rejects_bad_scale(client):
    assert export(client, glb(box()), scale="0").status_code == 422
