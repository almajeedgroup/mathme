"""Write the heart and its halves as GLB / STL / OBJ, and draw labelled slice pictures."""

from __future__ import annotations

import io
from pathlib import Path

import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

from .catalog import CATEGORIES, CORE_PARTS, color_of
from .model import HeartModel
from .planes import Plane
from .slicer import SliceResult


def _material(key: str) -> PBRMaterial:
    r, g, b = color_of(key)
    return PBRMaterial(name=key, baseColorFactor=[r, g, b, 255], metallicFactor=0.0, roughnessFactor=0.55)


def write_glb(meshes: dict[str, trimesh.Trimesh], path: Path, model: HeartModel) -> None:
    """GLB in metres (the glTF standard), one named, coloured node per structure."""
    scene = trimesh.Scene()
    for key, mesh in meshes.items():
        m = mesh.copy()
        m.apply_scale(0.001)
        m.visual = trimesh.visual.TextureVisuals(material=_material(key))
        name = model.parts[key].info.name if key in model.parts else key
        scene.add_geometry(m, node_name=name, geom_name=key)
    path.write_bytes(scene.export(file_type="glb"))


def write_stl(meshes: dict[str, trimesh.Trimesh], path: Path) -> None:
    """One binary STL in millimetres (all structures together, for 3D printing)."""
    trimesh.util.concatenate(list(meshes.values())).export(path, file_type="stl")


def write_obj(meshes: dict[str, trimesh.Trimesh], path: Path, model: HeartModel) -> None:
    """OBJ + MTL in millimetres, one named object and colour per structure."""
    mtl_name = path.with_suffix(".mtl").name
    obj = io.StringIO()
    mtl = io.StringIO()
    obj.write(f"# Human heart (HRA reference, CC BY 4.0). Units: millimetres.\nmtllib {mtl_name}\n")
    offset = 1
    for key, mesh in meshes.items():
        r, g, b = (c / 255 for c in color_of(key))
        mtl.write(f"newmtl {key}\nKd {r:.4f} {g:.4f} {b:.4f}\nKa 0 0 0\nKs 0.1 0.1 0.1\nNs 20\n\n")
        obj.write(f"o {key}\nusemtl {key}\n")
        obj.writelines(f"v {x:.4f} {y:.4f} {z:.4f}\n" for x, y, z in mesh.vertices)
        obj.writelines(f"f {a + offset} {b + offset} {c + offset}\n" for a, b, c in mesh.faces)
        offset += len(mesh.vertices)
    path.write_text(obj.getvalue())
    path.with_suffix(".mtl").write_text(mtl.getvalue())


def write_all(meshes: dict[str, trimesh.Trimesh], stem: Path, model: HeartModel) -> list[str]:
    write_glb(meshes, stem.with_suffix(".glb"), model)
    write_stl(meshes, stem.with_suffix(".stl"))
    write_obj(meshes, stem.with_suffix(".obj"), model)
    return [stem.with_suffix(s).name for s in (".glb", ".stl", ".obj", ".mtl")]


def draw_section(result: SliceResult, path: Path, title: str, size_px: int = 1600) -> None:
    """A labelled cross-section picture with a 10 mm scale bar and body-direction arrows."""
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import PathPatch
    from matplotlib.path import Path as MplPath

    plane: Plane = result.plane
    fig, ax = plt.subplots(figsize=(8, 8), dpi=size_px / 8)
    fig.patch.set_facecolor("white")
    ax.set_aspect("equal")
    ax.axis("off")

    xs, ys = [], []
    for piece in result.sections:
        rgb = np.array(color_of(piece.key)) / 255
        for poly in piece.polygons:
            verts, codes = [], []
            for ring in [poly.exterior, *poly.interiors]:
                pts = np.asarray(ring.coords)
                verts.extend(pts)
                codes.extend([MplPath.MOVETO] + [MplPath.LINETO] * (len(pts) - 2) + [MplPath.CLOSEPOLY])
                xs.extend(pts[:, 0])
                ys.extend(pts[:, 1])
            ax.add_patch(
                PathPatch(MplPath(verts, codes), facecolor=(*rgb, 0.88), edgecolor=rgb * 0.55, lw=0.6)
            )
        for line in piece.lines:
            ax.plot(line[:, 0], line[:, 1], color=rgb * 0.8, lw=1.2)
            xs.extend(line[:, 0])
            ys.extend(line[:, 1])
    if not xs:
        plt.close(fig)
        return
    # frame the picture on the heart itself (long vessels can run far off the edge)
    core = [poly for piece in result.sections if piece.key in CORE_PARTS for poly in piece.polygons]
    if core:
        bx0 = min(p.bounds[0] for p in core)
        by0 = min(p.bounds[1] for p in core)
        bx1 = max(p.bounds[2] for p in core)
        by1 = max(p.bounds[3] for p in core)
        x0, x1, y0, y1 = bx0, bx1, by0, by1
        span = max(x1 - x0, y1 - y0) * 1.35
    else:
        x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
        span = max(x1 - x0, y1 - y0) * 1.18
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    ax.set_xlim(cx - span / 2, cx + span / 2)
    ax.set_ylim(cy - span / 2, cy + span / 2)

    # labels: one per structure, moved apart when they would overlap (with a thin leader line)
    fig.canvas.draw()
    renderer = fig.canvas.get_renderer()
    axes_box = ax.get_window_extent(renderer)
    placed = []
    step = span * 0.035
    offsets = [(0, 0)] + [
        (dx * step, dy * step)
        for r in (1, 2, 3)
        for dx, dy in ((0, r), (0, -r), (r, 0), (-r, 0), (r, r), (-r, -r), (r, -r), (-r, r))
    ]
    for piece in result.sections:
        if not piece.polygons or piece.area < 12:
            continue
        big = max(piece.polygons, key=lambda p: p.area)
        pt = big.representative_point()
        if not (cx - span / 2 < pt.x < cx + span / 2 and cy - span / 2 < pt.y < cy + span / 2):
            continue
        for dx, dy in offsets:
            t = ax.text(
                pt.x + dx,
                pt.y + dy,
                piece.name,
                fontsize=8.5,
                ha="center",
                va="center",
                color="#111",
                zorder=5,
                bbox={"boxstyle": "round,pad=0.2", "fc": "white", "ec": "none", "alpha": 0.8},
            )
            bb = t.get_window_extent(renderer).expanded(1.04, 1.25)
            inside = axes_box.contains(bb.x0, bb.y0) and axes_box.contains(bb.x1, bb.y1)
            if inside and not any(bb.overlaps(o) for o in placed):
                placed.append(bb)
                if dx or dy:
                    ax.plot([pt.x, pt.x + dx], [pt.y, pt.y + dy], color="#333", lw=0.5, zorder=4)
                    ax.plot([pt.x], [pt.y], "o", color="#333", ms=1.5, zorder=4)
                break
            t.remove()

    # 10 mm scale bar
    bx, by = cx - span / 2 + span * 0.05, cy - span / 2 + span * 0.05
    ax.plot([bx, bx + 10], [by, by], color="#111", lw=3)
    ax.text(bx + 5, by + span * 0.015, "10 mm", ha="center", va="bottom", fontsize=9)

    # which way is up/front/left in this picture
    e1, e2 = plane.basis()
    ox, oy, L = cx + span / 2 - span * 0.12, cy + span / 2 - span * 0.12, span * 0.07
    for vec, label, col in (
        ((0, 1, 0), "Head", "#2b8a3e"),
        ((0, 0, 1), "Front", "#1c7ed6"),
        ((1, 0, 0), "Left", "#c92a2a"),
    ):
        dx, dy = float(np.dot(vec, e1)), float(np.dot(vec, e2))
        if np.hypot(dx, dy) < 0.25:
            continue
        ax.annotate(
            "",
            xy=(ox + dx * L, oy + dy * L),
            xytext=(ox, oy),
            arrowprops={"arrowstyle": "->", "color": col, "lw": 1.6},
        )
        ax.text(
            ox + dx * L * 1.35, oy + dy * L * 1.35, label, color=col, fontsize=8, ha="center", va="center"
        )
    ax.set_title(title, fontsize=12, pad=6)
    fig.tight_layout()
    fig.savefig(path, dpi=size_px / 8)
    plt.close(fig)


def category_legend() -> list[tuple[str, tuple[int, int, int]]]:
    return [(c.label, c.color) for c in CATEGORIES.values()]
