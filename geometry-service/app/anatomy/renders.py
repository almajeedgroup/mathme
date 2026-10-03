"""3D pictures of the heart and its cut halves, drawn by web/scripts/render-glb.mjs (three.js in Chromium)."""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
SCRIPT = REPO / "web" / "scripts" / "render-glb.mjs"

WHOLE_VIEWS = [
    ("anterior", "Front (anterior) view", [0, 0, 1], [0, 1, 0]),
    ("posterior", "Back (posterior) view", [0, 0, -1], [0, 1, 0]),
    ("left", "Left side view", [1, 0, 0], [0, 1, 0]),
    ("right", "Right side view", [-1, 0, 0], [0, 1, 0]),
    ("superior", "Top (superior) view", [0, 1, 0], [0, 0, -1]),
    ("oblique", "Front-left oblique view", [0.6, 0.35, 0.72], [0, 1, 0]),
]


def available() -> bool:
    return (
        SCRIPT.exists()
        and shutil.which("node") is not None
        and (REPO / "web" / "node_modules" / "playwright").exists()
    )


def render_all(summary: dict, out: Path, core_box_m: list[list[float]], log=print) -> dict[str, str]:
    """Returns {name: relative png path}. Skips quietly if Node/Chromium are not available."""
    if not available():
        log("  3D renderer not available (needs web/node_modules and Node): skipping 3D pictures")
        return {}
    rdir = out / "renders"
    rdir.mkdir(exist_ok=True)
    jobs, names = [], {}
    for vid, _label, d, up in WHOLE_VIEWS:
        png = rdir / f"whole_{vid}.png"
        jobs.append(
            {
                "glb": str(out / "whole" / "heart.glb"),
                "out": str(png),
                "dir": d,
                "up": up,
                "size": 1000,
                "box": core_box_m,
            }
        )
        names[f"whole_{vid}"] = f"renders/{png.name}"
    for p in summary["planes"]:
        png = rdir / f"{p['id']}_cut.png"
        # camera on the positive side looks at the cut face of the negative half
        jobs.append(
            {
                "glb": str(out / p["files"]["glb_both_halves"]),
                "out": str(png),
                "dir": p["normal"],
                "up": p["up"],
                "half": 1,
                "size": 900,
                "box": core_box_m,
            }
        )
        names[f"{p['id']}_cut"] = f"renders/{png.name}"
    jobs_file = out / "render-jobs.json"
    jobs_file.write_text(json.dumps(jobs))
    try:
        subprocess.run(
            ["node", str(SCRIPT), str(jobs_file)],
            cwd=REPO / "web",
            check=True,
            capture_output=True,
            timeout=900,
        )
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
        log(f"  3D renderer failed: {exc}")
        return {}
    finally:
        jobs_file.unlink(missing_ok=True)
    return names
