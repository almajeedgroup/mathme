"""Load the HRA reference heart, convert it to millimetres and make every part a closed solid."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import manifold3d as m3d
import numpy as np
import trimesh

from .catalog import PartInfo, part_info

DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "heart"
DEFAULT_MODEL = DATA_DIR / "VH_M_Heart_v1.1.glb"
PREFIX = "VH_M_"


@dataclass
class Part:
    key: str
    info: PartInfo
    mesh: trimesh.Trimesh  # full detail, millimetres; body axes: +X patient left, +Y superior, +Z anterior
    solid: m3d.Manifold | None  # None when the part could not be made a closed solid
    repaired: bool
    # lighter copy used for the cut halves (files stay a sensible size), and how far it strays (mm)
    light: trimesh.Trimesh | None = None
    light_solid: m3d.Manifold | None = None
    light_deviation: float = 0.0


@dataclass
class HeartModel:
    parts: dict[str, Part]
    source: Path

    def meshes(self, keys=None) -> list[trimesh.Trimesh]:
        return [p.mesh for k, p in self.parts.items() if keys is None or k in keys]

    def bounds(self, keys=None) -> np.ndarray:
        ms = self.meshes(keys)
        return np.array(
            [np.min([m.bounds[0] for m in ms], axis=0), np.max([m.bounds[1] for m in ms], axis=0)]
        )


def to_manifold(mesh: trimesh.Trimesh) -> m3d.Manifold | None:
    man = m3d.Manifold(
        m3d.Mesh(
            vert_properties=np.asarray(mesh.vertices, dtype=np.float32),
            tri_verts=np.asarray(mesh.faces, dtype=np.uint32),
        )
    )
    return man if man.status() == m3d.Error.NoError and man.volume() > 0 else None


def from_manifold(man: m3d.Manifold) -> trimesh.Trimesh:
    out = man.to_mesh()
    return trimesh.Trimesh(np.asarray(out.vert_properties)[:, :3], np.asarray(out.tri_verts), process=True)


def _meshfix(mesh: trimesh.Trimesh) -> trimesh.Trimesh | None:
    from pymeshfix import MeshFix

    mf = MeshFix(np.asarray(mesh.vertices, dtype=float), np.asarray(mesh.faces, dtype=np.int32))
    mf.repair()
    fixed = trimesh.Trimesh(mf.points, mf.faces)
    return fixed if len(fixed.faces) and fixed.is_watertight else None


def make_solid(mesh: trimesh.Trimesh) -> tuple[trimesh.Trimesh, bool]:
    """Close holes so the part can be cut with a closed face. Pieces that can't be fixed stay open."""
    if mesh.is_watertight:
        return mesh, False
    whole = _meshfix(mesh)
    if whole is not None and 0.75 < whole.area / max(mesh.area, 1e-9) < 1.6:
        return whole, True
    # MeshFix keeps only the biggest piece, so mend separate pieces (e.g. vessel branches) one by one
    pieces = [p for p in mesh.split(only_watertight=False) if len(p.faces) >= 4] or [mesh]
    if len(pieces) > 200:
        return mesh, False  # too fragmented to repair safely; keep it as an open surface
    out = []
    for piece in pieces:
        if piece.is_watertight:
            out.append(piece)
            continue
        fixed = _meshfix(piece)
        # keep the repair only if it did not throw away a large part of the surface
        if fixed is not None and 0.75 < fixed.area / max(piece.area, 1e-9) < 1.6:
            out.append(fixed)
        else:
            out.append(piece)
    result = trimesh.util.concatenate(out) if len(out) > 1 else out[0]
    return result, True


def max_deviation(a: trimesh.Trimesh, b: trimesh.Trimesh, samples: int = 3000) -> float:
    """Largest distance (mm) between the two surfaces, checked both ways on sample points."""
    rng = np.random.default_rng(0)
    worst = 0.0
    for src, dst in ((a, b), (b, a)):
        pts = src.vertices[rng.choice(len(src.vertices), min(samples, len(src.vertices)), replace=False)]
        _, dist, _ = trimesh.proximity.closest_point(dst, pts)
        worst = max(worst, float(np.max(dist)))
    return worst


def simplify(mesh: trimesh.Trimesh, max_dev: float) -> tuple[trimesh.Trimesh, float]:
    """Remove triangles where the surface is flatter than needed, keeping the shape within max_dev mm."""
    import fast_simplification

    best, best_dev = mesh, 0.0
    for reduction in (0.75, 0.6, 0.4):
        if len(mesh.faces) < 400:
            break
        v, f = fast_simplification.simplify(
            np.asarray(mesh.vertices, np.float32),
            np.asarray(mesh.faces, np.int32),
            target_reduction=reduction,
        )
        light = trimesh.Trimesh(v, f, process=True)
        if mesh.is_watertight and not light.is_watertight:
            continue
        dev = max_deviation(mesh, light)
        if dev <= max_dev:
            best, best_dev = light, dev
            break
    return best, best_dev


def load_heart(path: Path = DEFAULT_MODEL, light_max_dev: float | None = None) -> HeartModel:
    scene = trimesh.load(path, force="scene")
    parts: dict[str, Part] = {}
    for node in scene.graph.nodes_geometry:
        transform, geom_name = scene.graph[node]
        mesh = scene.geometry[geom_name].copy()
        mesh.apply_transform(transform)
        mesh.apply_scale(1000.0)  # metres -> millimetres
        mesh = trimesh.Trimesh(mesh.vertices, mesh.faces, process=True)
        mesh.merge_vertices()
        mesh, repaired = make_solid(mesh)
        trimesh.repair.fix_normals(mesh)
        key = geom_name.removeprefix(PREFIX)
        solid = to_manifold(mesh) if mesh.is_watertight else None
        if solid is None and mesh.is_watertight and 1 < mesh.body_count <= 200:
            # several closed pieces: join them into one solid
            bodies = [to_manifold(b) for b in mesh.split(only_watertight=False)]
            if bodies and all(b is not None for b in bodies):
                solid = m3d.Manifold.batch_boolean(bodies, m3d.OpType.Add)
        part = Part(key=key, info=part_info(key), mesh=mesh, solid=solid, repaired=repaired)
        if light_max_dev:
            part.light, part.light_deviation = simplify(mesh, light_max_dev)
            part.light_solid = (
                to_manifold(part.light) if solid is not None and part.light.is_watertight else None
            )
            if solid is not None and part.light_solid is None:  # simplification broke it: use full detail
                part.light, part.light_solid, part.light_deviation = mesh, solid, 0.0
        parts[key] = part
    return HeartModel(parts=parts, source=Path(path))
