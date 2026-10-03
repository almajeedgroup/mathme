"""Mesh loading, cleaning, measuring, boolean operations and exporting."""

from __future__ import annotations

import io
from dataclasses import dataclass, field

import numpy as np
import trimesh

from .settings import Settings


class GeometryError(Exception):
    """A problem with the student's model that we can explain in plain words."""

    status_code = 422


class TooBigError(GeometryError):
    status_code = 413


def load_parts(data: bytes, settings: Settings) -> list[trimesh.Trimesh]:
    """Load every mesh in a GLB file, moved into place (world coordinates) and cleaned."""
    if not data:
        raise GeometryError("The file is empty.")
    try:
        scene = trimesh.load(io.BytesIO(data), file_type="glb", force="scene", process=False)
    except Exception as exc:  # noqa: BLE001 - any parse failure means a bad file
        raise GeometryError("This is not a valid GLB 3D file.") from exc
    meshes = [g for g in scene.dump() if isinstance(g, trimesh.Trimesh) and len(g.faces) > 0]
    triangles = sum(len(m.faces) for m in meshes)
    if triangles > settings.max_triangles:
        raise TooBigError(
            f"The model has {triangles:,} triangles; the limit is {settings.max_triangles:,}. "
            "Use fewer objects or lower the smoothness."
        )
    parts = [clean(m) for m in meshes]
    parts = [p for p in parts if len(p.faces) > 0]
    if not parts:
        raise GeometryError("There are no triangles in this file.")
    return parts


def clean(mesh: trimesh.Trimesh) -> trimesh.Trimesh:
    """Join duplicate corners (three.js splits them at texture seams) and drop zero-area triangles."""
    mesh = trimesh.Trimesh(vertices=mesh.vertices, faces=mesh.faces, process=False)
    mesh.merge_vertices(merge_tex=True, merge_norm=True)
    mesh.update_faces(mesh.nondegenerate_faces())
    mesh.remove_unreferenced_vertices()
    return mesh


def union_all(solids: list[trimesh.Trimesh], settings: Settings) -> trimesh.Trimesh:
    if not solids:
        raise GeometryError("There are no solid shapes to join.")
    if len(solids) > settings.max_union_parts:
        raise TooBigError(
            f"There are {len(solids):,} solid parts; at most {settings.max_union_parts:,} can be joined."
        )
    if len(solids) == 1:
        return solids[0].copy()
    return trimesh.boolean.union(solids, engine="manifold")


def solid_parts(parts: list[trimesh.Trimesh], what: str) -> list[trimesh.Trimesh]:
    solids = [p for p in parts if p.is_watertight]
    if len(solids) != len(parts):
        raise GeometryError(
            f"{what} contains an open sheet or surface (it has no inside), so it can't be combined or cut. "
            "Only closed solid shapes work."
        )
    return solids


@dataclass
class Analysis:
    parts: int
    solid_parts: int
    open_parts: int
    triangles: int
    volume: float | None
    volume_sum: float
    overlap_volume: float | None
    surface_area: float
    bounds_min: list[float]
    bounds_max: list[float]
    size: list[float]
    is_watertight: bool
    bodies: int | None
    notes: list[str] = field(default_factory=list)


def analyze(parts: list[trimesh.Trimesh], settings: Settings) -> Analysis:
    solids = [p for p in parts if p.is_watertight]
    sheets = [p for p in parts if not p.is_watertight]
    notes: list[str] = []
    volume_sum = float(sum(p.volume for p in solids))
    joined: trimesh.Trimesh | None = None
    if solids:
        try:
            joined = union_all(solids, settings)
        except TooBigError as exc:
            notes.append(f"{exc} Overlapping parts are counted twice in the volume.")
        except Exception:  # noqa: BLE001 - manifold can fail on odd input; report, don't crash
            notes.append("The shapes could not be joined, so overlapping parts are counted twice.")
    if sheets:
        notes.append(f"{len(sheets)} part(s) are open sheets with no inside, so they have no volume.")
    lo = np.min([p.bounds[0] for p in parts], axis=0)
    hi = np.max([p.bounds[1] for p in parts], axis=0)
    sheet_area = float(sum(p.area for p in sheets))
    bodies = len(joined.split(only_watertight=False)) if joined is not None and len(joined.faces) else None
    if bodies and bodies > 1:
        notes.append(f"The model is in {bodies} separate pieces that don't touch.")
    return Analysis(
        parts=len(parts),
        solid_parts=len(solids),
        open_parts=len(sheets),
        triangles=int(sum(len(p.faces) for p in parts)),
        volume=float(joined.volume) if joined is not None else (volume_sum if solids else None),
        volume_sum=volume_sum,
        overlap_volume=max(0.0, volume_sum - float(joined.volume)) if joined is not None else None,
        surface_area=(float(joined.area) if joined is not None else float(sum(p.area for p in solids)))
        + sheet_area,
        bounds_min=lo.round(6).tolist(),
        bounds_max=hi.round(6).tolist(),
        size=(hi - lo).round(6).tolist(),
        is_watertight=bool(joined is not None and joined.is_watertight and not sheets),
        bodies=bodies,
        notes=notes,
    )


OPERATIONS = ("union", "difference", "intersection")


def boolean(
    a: list[trimesh.Trimesh], b: list[trimesh.Trimesh], operation: str, settings: Settings
) -> trimesh.Trimesh:
    if operation not in OPERATIONS:
        raise GeometryError(f"Unknown operation {operation!r}.")
    first = union_all(solid_parts(a, "The first shape"), settings)
    second = union_all(solid_parts(b, "The second shape"), settings)
    op = {
        "union": trimesh.boolean.union,
        "difference": trimesh.boolean.difference,
        "intersection": trimesh.boolean.intersection,
    }[operation]
    result = op([first, second], engine="manifold")
    if result is None or len(result.faces) == 0:
        raise GeometryError(
            "The shapes don't overlap, so nothing is left."
            if operation == "intersection"
            else "Nothing is left after cutting."
        )
    return result


EXPORT_FORMATS = {
    "stl": "model/stl",
    "obj": "model/obj",
    "ply": "application/octet-stream",
    "3mf": "model/3mf",
}


def print_ready(
    parts: list[trimesh.Trimesh], *, union: bool, repair: bool, scale: float, settings: Settings
) -> tuple[trimesh.Trimesh, list[str]]:
    """Make one mesh for a 3D printer: fix normals, join overlapping solids, scale to millimetres."""
    notes: list[str] = []
    if repair:
        for p in parts:
            trimesh.repair.fix_normals(p)
            if not p.is_watertight:
                trimesh.repair.fill_holes(p)
    solids = [p for p in parts if p.is_watertight]
    sheets = [p for p in parts if not p.is_watertight]
    if sheets:
        notes.append(f"{len(sheets)} open sheet(s) can't be printed as solids and were kept as they are.")
    if union and solids:
        merged = [union_all(solids, settings), *sheets]
    else:
        merged = parts
    mesh = trimesh.util.concatenate(merged) if len(merged) > 1 else merged[0]
    mesh.apply_scale(scale)
    return mesh, notes


def export_mesh(mesh: trimesh.Trimesh, file_format: str) -> bytes:
    if file_format not in EXPORT_FORMATS:
        raise GeometryError(f"Unknown format {file_format!r}.")
    out = mesh.export(file_type=file_format)
    return out.encode("utf-8") if isinstance(out, str) else bytes(out)


def to_glb(mesh: trimesh.Trimesh) -> bytes:
    return bytes(trimesh.Scene(mesh).export(file_type="glb"))


def slice_parts(
    parts: list[trimesh.Trimesh], point: list[float], normal: list[float]
) -> tuple[list[trimesh.Trimesh], list[trimesh.Trimesh], int]:
    """Cut every part with a plane. Closed parts get a closed cut face; open sheets are just trimmed.

    Returns (parts on the side the normal points to, parts on the other side, number of open parts).
    """
    import manifold3d as m3d

    n = np.asarray(normal, dtype=float)
    length = np.linalg.norm(n)
    if not np.isfinite(length) or length < 1e-9:
        raise GeometryError("The cutting direction (normal) can't be zero.")
    n = n / length
    p = np.asarray(point, dtype=float)
    pos: list[trimesh.Trimesh] = []
    neg: list[trimesh.Trimesh] = []
    open_count = 0
    for part in parts:
        side = (part.vertices - p) @ n
        if side.min() >= 0:
            pos.append(part)
            continue
        if side.max() <= 0:
            neg.append(part)
            continue
        solid = None
        if part.is_watertight:
            solid = m3d.Manifold(
                m3d.Mesh(
                    vert_properties=np.asarray(part.vertices, np.float32),
                    tri_verts=np.asarray(part.faces, np.uint32),
                )
            )
            if solid.status() != m3d.Error.NoError:
                solid = None
        if solid is not None:
            for half, out in zip(solid.split_by_plane(n.tolist(), float(n @ p)), (pos, neg), strict=True):
                if half.num_tri():
                    m = half.to_mesh()
                    out.append(trimesh.Trimesh(np.asarray(m.vert_properties)[:, :3], np.asarray(m.tri_verts)))
        else:
            open_count += 1
            for sign, out in ((1, pos), (-1, neg)):
                piece = trimesh.intersections.slice_mesh_plane(part, sign * n, p, cap=False)
                if len(piece.faces):
                    out.append(piece)
    if not pos or not neg:
        raise GeometryError("The cutting plane misses the model, so there is nothing to cut.")
    return pos, neg, open_count


def halves_glb(pos: list[trimesh.Trimesh], neg: list[trimesh.Trimesh]) -> bytes:
    """One GLB with the two halves as separate named groups (in the model's own units)."""
    scene = trimesh.Scene()
    for label, half in (("side A (normal side)", pos), ("side B", neg)):
        scene.graph.update(frame_to=label, frame_from=scene.graph.base_frame)
        for i, m in enumerate(half):
            scene.add_geometry(m, node_name=f"{label} part {i + 1}", parent_node_name=label)
    return bytes(scene.export(file_type="glb"))
