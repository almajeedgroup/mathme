"""The heart's own axes (from anatomical landmarks) and the named cutting planes."""

from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np

from .catalog import CORE_PARTS
from .model import HeartModel

X, Y, Z = np.eye(3)  # +X patient left, +Y superior (head), +Z anterior (front)
AXIS_NAMES = {0: ("left", "right"), 1: ("superior", "inferior"), 2: ("anterior", "posterior")}


def unit(v) -> np.ndarray:
    v = np.asarray(v, dtype=float)
    return v / np.linalg.norm(v)


@dataclass
class Landmarks:
    apex: np.ndarray
    mitral: np.ndarray
    tricuspid: np.ndarray
    aortic: np.ndarray
    pulmonary: np.ndarray
    long_axis: np.ndarray  # unit vector from the apex towards the mitral valve (base)
    length: float  # apex to mitral valve, mm


def landmarks(model: HeartModel) -> Landmarks:
    c = {
        k: model.parts[k].mesh.centroid
        for k in ("mitral_valve", "tricuspid_valve", "aortic_valve", "pulmonary_valve")
    }
    lv = model.parts["heart_left_ventricle"].mesh
    # the apex is the point of the left ventricle farthest from the mitral valve
    d = np.linalg.norm(lv.vertices - c["mitral_valve"], axis=1)
    apex = lv.vertices[int(np.argmax(d))]
    axis = c["mitral_valve"] - apex
    return Landmarks(
        apex=apex,
        mitral=c["mitral_valve"],
        tricuspid=c["tricuspid_valve"],
        aortic=c["aortic_valve"],
        pulmonary=c["pulmonary_valve"],
        long_axis=unit(axis),
        length=float(np.linalg.norm(axis)),
    )


@dataclass
class Plane:
    id: str
    name: str
    group: str  # "anatomical" or "cardiac"
    point: np.ndarray  # a point on the plane (mm)
    normal: np.ndarray  # unit normal; the "positive" half is on this side
    view: np.ndarray  # unit vector pointing from the cut towards the viewer of the slice picture
    up: np.ndarray  # direction shown as "up" in the slice picture
    teaches: str  # what this view is used for
    halves: tuple[str, str] | None = None  # plain names for the two halves (positive side first)

    @property
    def offset(self) -> float:
        return float(self.normal @ self.point)

    def side_names(self) -> tuple[str, str]:
        """Plain names for the two halves, from the body axis closest to the normal."""
        if self.halves:
            return self.halves
        k = int(np.argmax(np.abs(self.normal)))
        pos, neg = AXIS_NAMES[k]
        return (pos, neg) if self.normal[k] > 0 else (neg, pos)

    def basis(self) -> tuple[np.ndarray, np.ndarray]:
        """Picture axes: e1 points right, e2 points up, as seen by the viewer."""
        e2 = unit(self.up - (self.up @ self.view) * self.view)
        e1 = np.cross(e2, self.view)
        return e1, e2

    def angles_to_body_axes(self) -> dict[str, float]:
        """Angle (degrees) between the plane normal and each body axis."""
        return {
            name: float(np.degrees(np.arccos(min(1.0, abs(self.normal @ ax)))))
            for name, ax in (("left-right (X)", X), ("head-feet (Y)", Y), ("front-back (Z)", Z))
        }

    def to_json(self) -> dict:
        d = asdict(self)
        for k in ("point", "normal", "view", "up"):
            d[k] = [round(float(v), 4) for v in d[k]]
        d["offset_mm"] = round(self.offset, 4)
        d["equation"] = "{:.4f}·x + {:.4f}·y + {:.4f}·z = {:.3f}".format(*self.normal, self.offset)
        d["angles_to_body_axes_deg"] = {k: round(v, 2) for k, v in self.angles_to_body_axes().items()}
        d["halves"] = list(self.side_names())
        return d


ANATOMICAL_TEACHES = {
    "axial": "Like a CT or MRI slice seen from the feet: the patient's left is on the right of the picture and "
    "the front is at the top. Used to relate the heart to the sternum, lungs, aorta and oesophagus.",
    "coronal": "A front view slice, as if facing the patient: the patient's left is on the right of the picture. "
    "Shows the heart's borders and the great vessels above it.",
    "sagittal": "A side view slice seen from the patient's left: the front is on the left of the picture. "
    "Shows the front-to-back order: right ventricle at the front, left atrium at the back.",
}

CARDIAC_TEACHES = {
    "four_chamber": "Shows all four chambers, both atrioventricular valves (mitral and tricuspid) and the septa "
    "between them. The standard view for chamber size, AV valve function and septal defects "
    "(apical four-chamber view in echocardiography).",
    "two_chamber": "Shows only the left atrium and left ventricle, with the anterior and inferior walls of the left "
    "ventricle and the mitral valve.",
    "three_chamber": "The left ventricle outflow tract (LVOT) view: left atrium, mitral valve, left ventricle, "
    "aortic valve and aortic root in one picture. Key for aortic valve disease and outflow obstruction.",
    "sax_basal": "Short-axis slice near the base, at the level of the mitral valve: the right ventricle wraps around "
    "the round left ventricle.",
    "sax_mid": "Short-axis slice at mid-ventricle, at the level of the papillary muscles. Used to compare the "
    "walls supplied by each coronary artery.",
    "sax_apical": "Short-axis slice near the apex, where the left ventricle becomes small and round.",
}


def build_planes(model: HeartModel, levels: int = 5) -> tuple[list[Plane], Landmarks]:
    lm = landmarks(model)
    lo, hi = model.bounds(CORE_PARTS)
    centre = (lo + hi) / 2
    planes: list[Plane] = []

    # anatomical planes at evenly spaced levels through the heart itself
    anat = [
        ("axial", "Axial", Y, -Y, Z, 1),
        ("coronal", "Coronal", Z, Z, Y, 2),
        ("sagittal", "Sagittal", X, X, Y, 0),
    ]
    for kind, label, normal, view, up, k in anat:
        for i in range(levels):
            f = (i + 1) / (levels + 1)
            point = centre.copy()
            point[k] = lo[k] + f * (hi[k] - lo[k])
            planes.append(
                Plane(
                    id=f"{kind}_{i + 1}",
                    name=f"{label} {i + 1} of {levels} ({AXIS_NAMES[k][1]} to {AXIS_NAMES[k][0]}, at {point[k]:.1f} mm)",
                    group="anatomical",
                    point=point,
                    normal=normal.copy(),
                    view=view.copy(),
                    up=up.copy(),
                    teaches=ANATOMICAL_TEACHES[kind],
                )
            )

    u = lm.long_axis
    # four-chamber: through the apex and the mitral and tricuspid valve centres
    n4 = unit(np.cross(lm.mitral - lm.apex, lm.tricuspid - lm.apex))
    if n4 @ Z < 0:
        n4 = -n4
    # three-chamber (LVOT): apex, mitral and aortic valve centres
    n3 = unit(np.cross(lm.mitral - lm.apex, lm.aortic - lm.apex))
    if n3 @ X < 0:
        n3 = -n3
    # two-chamber: contains the long axis, at right angles to the four-chamber plane
    n2 = unit(np.cross(u, n4))
    if n2 @ X < 0:
        n2 = -n2
    for pid, name, n in (
        ("four_chamber", "Four-chamber view", n4),
        ("two_chamber", "Two-chamber view", n2),
        ("three_chamber", "Three-chamber (LVOT) view", n3),
    ):
        planes.append(Plane(pid, name, "cardiac", lm.apex.copy(), n, n, u.copy(), CARDIAC_TEACHES[pid]))
    # short axis: at right angles to the long axis, seen from the apex with the front at the top
    for pid, name, f in (
        ("sax_basal", "Short axis, basal", 0.75),
        ("sax_mid", "Short axis, mid-ventricle", 0.5),
        ("sax_apical", "Short axis, apical", 0.25),
    ):
        planes.append(
            Plane(
                pid,
                f"{name} ({int(f * 100)}% from apex)",
                "cardiac",
                lm.apex + f * lm.length * u,
                u.copy(),
                -u,
                Z.copy(),
                CARDIAC_TEACHES[pid],
                halves=("base side", "apex side"),
            )
        )
    return planes, lm


def custom_plane(point, normal, name: str = "Custom cut") -> Plane:
    n = unit(normal)
    up = Y if abs(n @ Y) < 0.9 else Z
    return Plane(
        "custom", name, "custom", np.asarray(point, float), n, n, up.copy(), "A cut at a chosen angle."
    )
