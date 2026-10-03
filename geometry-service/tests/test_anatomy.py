"""Tests for the heart slice atlas pipeline (needs the [anatomy] extras)."""

import numpy as np
import pytest

pytest.importorskip("pymeshfix")
pytest.importorskip("shapely")
pytest.importorskip("scipy")

from app.anatomy.build import LIGHT_MAX_DEV_MM, build  # noqa: E402
from app.anatomy.catalog import CORE_PARTS, part_info  # noqa: E402
from app.anatomy.model import load_heart  # noqa: E402
from app.anatomy.planes import build_planes, custom_plane  # noqa: E402
from app.anatomy.slicer import picture_transform, slice_heart  # noqa: E402


@pytest.fixture(scope="module")
def heart():
    return load_heart(light_max_dev=LIGHT_MAX_DEV_MM)


@pytest.fixture(scope="module")
def planes(heart):
    return build_planes(heart)


def test_model_is_a_real_size_adult_heart(heart):
    assert len(heart.parts) == 51
    lo, hi = heart.bounds(CORE_PARTS)
    size = hi - lo
    assert np.all((size > 90) & (size < 140)), size  # millimetres
    solids = [p for p in heart.parts.values() if p.solid is not None]
    assert len(solids) >= 50
    # every part has a plain name and a known group
    for key in heart.parts:
        assert part_info(key).name and part_info(key).category


def test_lighter_copies_stay_close(heart):
    for p in heart.parts.values():
        assert p.light_deviation <= LIGHT_MAX_DEV_MM + 1e-9


def test_planes_follow_their_definitions(planes):
    ps, lm = planes
    by = {p.id: p for p in ps}
    assert len(ps) == 21
    for p in ps:
        assert np.linalg.norm(p.normal) == pytest.approx(1)
    on = lambda plane, x: abs(plane.normal @ x - plane.offset)  # noqa: E731
    four, three, two = by["four_chamber"], by["three_chamber"], by["two_chamber"]
    for x in (lm.apex, lm.mitral, lm.tricuspid):
        assert on(four, x) < 0.5
    for x in (lm.apex, lm.mitral, lm.aortic):
        assert on(three, x) < 0.5
    assert abs(two.normal @ four.normal) < 0.02  # at right angles
    assert abs(two.normal @ lm.long_axis) < 1e-6  # contains the long axis
    for pid, f in (("sax_apical", 0.25), ("sax_mid", 0.5), ("sax_basal", 0.75)):
        sax = by[pid]
        assert sax.normal @ lm.long_axis == pytest.approx(1)
        assert sax.normal @ (sax.point - lm.apex) == pytest.approx(f * lm.length)
    # long axis points from the apex up, to the right and back, as in a normal heart
    assert lm.long_axis[1] > 0 and lm.long_axis[0] < 0 and lm.long_axis[2] < 0
    assert 70 < lm.length < 110


def test_picture_basis_is_right_handed(planes):
    for p in planes[0]:
        e1, e2 = p.basis()
        assert np.cross(e1, e2) @ p.view == pytest.approx(1)


def test_halves_add_up_and_are_closed(heart, planes):
    ps, _ = planes
    four = next(p for p in ps if p.id == "four_chamber")
    res = slice_heart(heart, four)
    for key in ("heart_left_ventricle", "left_cardiac_atrium", "heart_right_ventricle"):
        part = heart.parts[key]
        a, b = res.positive[key], res.negative[key]
        assert a.is_watertight and b.is_watertight
        assert a.volume + b.volume == pytest.approx(part.light.volume, rel=0.005)
    names = {s.key for s in res.sections}
    assert {
        "heart_left_ventricle",
        "heart_right_ventricle",
        "left_cardiac_atrium",
        "right_cardiac_atrium",
    } <= names
    assert {"mitral_valve", "tricuspid_valve"} <= names  # the four-chamber view shows both AV valves


def test_section_areas_match_an_independent_calculation(heart, planes):
    p = next(x for x in planes[0] if x.id == "sax_mid")
    res = slice_heart(heart, p, with_halves=False)
    lv = next(s for s in res.sections if s.key == "heart_left_ventricle")
    sec = heart.parts["heart_left_ventricle"].mesh.section(plane_origin=p.point, plane_normal=p.normal)
    planar, _ = sec.to_planar(check=False)
    assert lv.area == pytest.approx(planar.area, rel=1e-6)
    assert lv.area > 100  # mm², a real ring of muscle


def test_custom_plane_and_picture_transform(heart):
    c = heart.parts["heart_left_ventricle"].mesh.centroid
    p = custom_plane(c, [1, 1, 0])
    m = picture_transform(p)
    assert np.allclose((m @ np.append(c, 1))[:3], 0)


def test_build_writes_every_file(heart, tmp_path):
    summary = build(tmp_path, levels=1, pdf=False, log=lambda *_: None, model=heart)
    assert len(summary["planes"]) == 3 + 6
    for f in (
        "whole/heart.glb",
        "whole/heart.stl",
        "whole/heart.obj",
        "whole/heart.mtl",
        "whole/heart_light.glb",
        "whole/heart-views.json",
        "planes.json",
        "heart-3d-models.zip",
        "heart-print-stl.zip",
    ):
        assert (tmp_path / f).stat().st_size > 0, f
    for p in summary["planes"]:
        assert (tmp_path / p["files"]["glb_both_halves"]).stat().st_size > 1000
        assert (tmp_path / p["files"]["image"]).stat().st_size > 1000
        for stl in p["files"]["stl"].values():
            data = (tmp_path / stl).read_bytes()
            n = int.from_bytes(data[80:84], "little")
            assert len(data) == 84 + 50 * n
