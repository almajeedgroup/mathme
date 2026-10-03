"""Cut the heart along a plane: two capped halves per part, and the cross-section outline per part."""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import trimesh

from .model import HeartModel, Part, from_manifold
from .planes import Plane


@dataclass
class SectionPiece:
    key: str
    name: str
    polygons: list  # shapely Polygons in picture coordinates (mm)
    lines: list[np.ndarray]  # open outlines (parts that are not closed solids)
    area: float  # mm²
    perimeter: float  # mm


@dataclass
class SliceResult:
    plane: Plane
    positive: dict[str, trimesh.Trimesh] = field(
        default_factory=dict
    )  # half on the side the normal points to
    negative: dict[str, trimesh.Trimesh] = field(default_factory=dict)
    sections: list[SectionPiece] = field(default_factory=list)
    open_cut_parts: list[str] = field(default_factory=list)  # cut without a closed face


def picture_transform(plane: Plane) -> np.ndarray:
    """4×4 matrix taking 3D points (mm) to picture coordinates: x right, y up, z towards the viewer."""
    e1, e2 = plane.basis()
    m = np.eye(4)
    m[:3, :3] = np.vstack([e1, e2, plane.view])
    m[:3, 3] = -m[:3, :3] @ plane.point
    return m


def cut_part(part: Part, plane: Plane) -> tuple[trimesh.Trimesh | None, trimesh.Trimesh | None, bool]:
    """Return (positive half, negative half, capped?). Uses the lighter copy when there is one."""
    n, p = plane.normal, plane.point
    mesh = part.light if part.light is not None else part.mesh
    solid = part.light_solid if part.light is not None else part.solid
    side = (mesh.vertices - p) @ n
    if side.min() >= 0:
        return mesh, None, True
    if side.max() <= 0:
        return None, mesh, True
    if solid is not None:
        a, b = solid.split_by_plane(n.tolist(), float(plane.offset))
        pos = from_manifold(a) if a.num_tri() else None
        neg = from_manifold(b) if b.num_tri() else None
        return pos, neg, True
    pos = trimesh.intersections.slice_mesh_plane(mesh, n, p, cap=False)
    neg = trimesh.intersections.slice_mesh_plane(mesh, -n, p, cap=False)
    return (pos if len(pos.faces) else None), (neg if len(neg.faces) else None), False


def section_part(part: Part, plane: Plane, to_picture: np.ndarray) -> SectionPiece | None:
    sec = part.mesh.section(plane_origin=plane.point, plane_normal=plane.normal)
    if sec is None:
        return None
    planar, _ = sec.to_planar(to_2D=to_picture, check=False)
    polygons = list(planar.polygons_full)
    area = float(sum(poly.area for poly in polygons))
    perimeter = float(sum(poly.exterior.length for poly in polygons))
    lines = [] if polygons else [np.asarray(d) for d in planar.discrete]
    if not polygons and not lines:
        return None
    return SectionPiece(part.key, part.info.name, polygons, lines, area, perimeter)


def slice_heart(model: HeartModel, plane: Plane, with_halves: bool = True) -> SliceResult:
    result = SliceResult(plane=plane)
    to_picture = picture_transform(plane)
    for key, part in model.parts.items():
        if with_halves:
            pos, neg, capped = cut_part(part, plane)
            if pos is not None:
                result.positive[key] = pos
            if neg is not None:
                result.negative[key] = neg
            if pos is not None and neg is not None and not capped:
                result.open_cut_parts.append(key)
        piece = section_part(part, plane, to_picture)
        if piece is not None:
            result.sections.append(piece)
    result.sections.sort(key=lambda s: -s.area)
    return result
