"""Build the heart slice atlas: python -m app.anatomy.build --out dist/heart

Writes the whole heart, both halves for every named plane (GLB with both halves, STL per half),
labelled slice pictures, planes.json, and (when reportlab is installed) the PDF atlas.
"""

from __future__ import annotations

import argparse
import json
import time
import zipfile
from pathlib import Path

from .catalog import CATEGORIES, CORE_PARTS
from .export import draw_section, write_all, write_glb, write_stl
from .model import HeartModel, load_heart
from .planes import build_planes
from .slicer import slice_heart

LIGHT_MAX_DEV_MM = 0.15


def part_table(model: HeartModel) -> list[dict]:
    rows = []
    for key, p in model.parts.items():
        size = p.mesh.extents
        rows.append(
            {
                "key": key,
                "name": p.info.name,
                "category": CATEGORIES[p.info.category].label,
                "volume_mm3": round(float(p.mesh.volume), 1) if p.solid is not None else None,
                "surface_area_mm2": round(float(p.mesh.area), 1),
                "size_mm": [round(float(v), 1) for v in size],
                "triangles": int(len(p.mesh.faces)),
                "closed_solid": p.solid is not None,
                "repaired": p.repaired,
                "halves_max_deviation_mm": round(p.light_deviation, 3),
                "note": p.info.note,
            }
        )
    return rows


def build(out: Path, levels: int = 5, pdf: bool = True, log=print, model: HeartModel | None = None) -> dict:
    t0 = time.time()
    out.mkdir(parents=True, exist_ok=True)
    (out / "whole").mkdir(exist_ok=True)
    (out / "slices").mkdir(exist_ok=True)
    (out / "images").mkdir(exist_ok=True)

    log("Loading and repairing the heart model…")
    model = model or load_heart(light_max_dev=LIGHT_MAX_DEV_MM)
    planes, lm = build_planes(model, levels=levels)
    log(f"  {len(model.parts)} parts ({time.time() - t0:.0f} s)")

    whole = {k: p.mesh for k, p in model.parts.items()}
    files = write_all(whole, out / "whole" / "heart", model)
    # lighter whole heart for web apps (same shapes within the stated deviation)
    write_glb(
        {k: (p.light if p.light is not None else p.mesh) for k, p in model.parts.items()},
        out / "whole" / "heart_light.glb",
        model,
    )
    files.append("heart_light.glb")

    summary = {
        "source": {
            "model": "Human Reference Atlas (HRA) 3D reference organ: heart, male (VH_M_Heart), ccf-releases v1.1",
            "url": "https://github.com/hubmapconsortium/ccf-releases/tree/main/v1.1/models",
            "license": "CC BY 4.0 (HRA). Credit: HuBMAP / Human Reference Atlas.",
            "units": "millimetres; GLB files are in metres (glTF standard)",
            "axes": "+X patient's left, +Y superior (head), +Z anterior (front)",
        },
        "landmarks_mm": {
            "apex": lm.apex.round(2).tolist(),
            "mitral_valve_centre": lm.mitral.round(2).tolist(),
            "tricuspid_valve_centre": lm.tricuspid.round(2).tolist(),
            "aortic_valve_centre": lm.aortic.round(2).tolist(),
            "pulmonary_valve_centre": lm.pulmonary.round(2).tolist(),
            "long_axis_unit": lm.long_axis.round(4).tolist(),
            "apex_to_mitral_mm": round(lm.length, 2),
        },
        "parts": part_table(model),
        "whole_files": [f"whole/{f}" for f in files],
        "planes": [],
    }

    for i, plane in enumerate(planes, 1):
        t = time.time()
        res = slice_heart(model, plane)
        pos_name, neg_name = plane.side_names()
        tag = lambda s: s.replace(" ", "-")  # noqa: E731
        # one GLB with both halves as separate named groups
        glb = out / "slices" / f"{plane.id}.glb"
        _write_two_halves(res, glb, model, (pos_name, neg_name))
        stl_pos = out / "slices" / f"{plane.id}_{tag(pos_name)}.stl"
        stl_neg = out / "slices" / f"{plane.id}_{tag(neg_name)}.stl"
        write_stl(res.positive, stl_pos)
        write_stl(res.negative, stl_neg)
        png = out / "images" / f"{plane.id}.png"
        draw_section(res, png, plane.name)
        entry = plane.to_json()
        entry["files"] = {
            "glb_both_halves": f"slices/{glb.name}",
            "stl": {pos_name: f"slices/{stl_pos.name}", neg_name: f"slices/{stl_neg.name}"},
            "image": f"images/{png.name}",
        }
        entry["structures_cut"] = [
            {
                "key": s.key,
                "name": s.name,
                "area_mm2": round(s.area, 1),
                "perimeter_mm": round(s.perimeter, 1),
            }
            for s in res.sections
        ]
        entry["open_cut_parts"] = res.open_cut_parts
        summary["planes"].append(entry)
        log(
            f"  [{i}/{len(planes)}] {plane.name}: {len(res.sections)} structures cut ({time.time() - t:.1f} s)"
        )

    (out / "planes.json").write_text(json.dumps(summary, indent=2))
    lo, hi = model.bounds(CORE_PARTS)
    (out / "whole" / "heart-views.json").write_text(
        json.dumps(
            {
                "units": "mm",
                "core_centre_mm": ((lo + hi) / 2).round(3).tolist(),
                "views": [
                    {
                        "id": p["id"],
                        "name": p["name"],
                        "group": p["group"],
                        "point": p["point"],
                        "normal": p["normal"],
                    }
                    for p in summary["planes"]
                ],
            },
            indent=1,
        )
    )

    if pdf:
        from .renders import render_all

        log("Drawing 3D pictures…")
        lo, hi = model.bounds(CORE_PARTS)
        renders = render_all(summary, out, [(lo / 1000).tolist(), (hi / 1000).tolist()], log=log)
        try:
            from .report import write_report
        except ImportError:
            log("reportlab is not installed: skipping the PDF")
        else:
            log("Writing the PDF atlas…")
            write_report(summary, out, out / "heart-slice-atlas.pdf", renders)

    log("Zipping…")
    _zip(out, out / "heart-3d-models.zip", ["whole/*", "slices/*.glb", "planes.json"])
    _zip(out, out / "heart-print-stl.zip", ["slices/*.stl", "whole/heart.stl"])
    _zip(out, out / "heart-slice-images.zip", ["images/*.png"])
    log(f"Done in {time.time() - t0:.0f} s → {out}")
    return summary


def _write_two_halves(res, path: Path, model: HeartModel, names: tuple[str, str]) -> None:
    import trimesh

    from .export import _material

    scene = trimesh.Scene()
    for half, label in ((res.positive, names[0]), (res.negative, names[1])):
        group = f"{res.plane.name} – {label} half"
        scene.graph.update(frame_to=group, frame_from=scene.graph.base_frame)
        for key, mesh in half.items():
            m = mesh.copy()
            m.apply_scale(0.001)
            m.visual = trimesh.visual.TextureVisuals(material=_material(key))
            scene.add_geometry(
                m,
                node_name=f"{model.parts[key].info.name} ({label})",
                geom_name=f"{key}_{label}",
                parent_node_name=group,
            )
    path.write_bytes(scene.export(file_type="glb"))


def _zip(root: Path, target: Path, patterns: list[str]) -> None:
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for pattern in patterns:
            for f in sorted(root.glob(pattern)):
                z.write(f, f.relative_to(root))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", type=Path, default=Path("dist/heart"))
    ap.add_argument("--levels", type=int, default=5, help="slices per anatomical direction")
    ap.add_argument("--no-pdf", action="store_true")
    args = ap.parse_args()
    build(args.out, levels=args.levels, pdf=not args.no_pdf)


if __name__ == "__main__":
    main()
