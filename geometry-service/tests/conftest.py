import pytest
import trimesh
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def glb(*meshes: trimesh.Trimesh) -> bytes:
    return bytes(trimesh.Scene(list(meshes)).export(file_type="glb"))


def box(extents=(2, 3, 4), at=(0, 0, 0)) -> trimesh.Trimesh:
    m = trimesh.creation.box(extents=extents)
    m.apply_translation(at)
    return m
