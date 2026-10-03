"""The PDF slice atlas (reportlab)."""

from __future__ import annotations

from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    CondPageBreak,
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from .catalog import CATEGORIES
from .renders import WHOLE_VIEWS

NOTICE = (
    "For education only. This is an anatomy and slice atlas of one reference heart, not a patient record or "
    "surgery report, and not for diagnosis or treatment. Teaching notes should be checked by a qualified "
    "cardiothoracic surgeon before use."
)
ACCENT = colors.HexColor("#9b1c2e")
INK = colors.HexColor("#1d1f24")
MUTED = colors.HexColor("#5c6270")
RULE = colors.HexColor("#d9dbe1")


def _fonts() -> tuple[str, str, str]:
    """DejaVu (ships with matplotlib) prints π, θ, →, ² and × correctly; fall back to Helvetica."""
    try:
        import matplotlib

        base = Path(matplotlib.get_data_path()) / "fonts" / "ttf"
        pdfmetrics.registerFont(TTFont("DejaVu", str(base / "DejaVuSans.ttf")))
        pdfmetrics.registerFont(TTFont("DejaVu-Bold", str(base / "DejaVuSans-Bold.ttf")))
        pdfmetrics.registerFont(TTFont("DejaVuMono", str(base / "DejaVuSansMono.ttf")))
        return "DejaVu", "DejaVu-Bold", "DejaVuMono"
    except Exception:  # noqa: BLE001
        return "Helvetica", "Helvetica-Bold", "Courier"


def _styles():
    body, bold, mono = _fonts()
    ss = getSampleStyleSheet()
    s = {
        "title": ParagraphStyle(
            "t", parent=ss["Title"], fontName=bold, fontSize=26, leading=31, textColor=ACCENT, alignment=0
        ),
        "subtitle": ParagraphStyle("st", fontName=body, fontSize=12.5, leading=17, textColor=MUTED),
        "h1": ParagraphStyle(
            "h1", fontName=bold, fontSize=17, leading=22, textColor=ACCENT, spaceBefore=4, spaceAfter=8
        ),
        "h2": ParagraphStyle(
            "h2", fontName=bold, fontSize=12.5, leading=16, textColor=INK, spaceBefore=8, spaceAfter=4
        ),
        "body": ParagraphStyle("b", fontName=body, fontSize=9.6, leading=13.6, textColor=INK, spaceAfter=5),
        "small": ParagraphStyle("s", fontName=body, fontSize=8.2, leading=11, textColor=MUTED),
        "mono": ParagraphStyle("m", fontName=mono, fontSize=8.4, leading=11.5, textColor=INK, spaceAfter=3),
        "caption": ParagraphStyle(
            "c", fontName=body, fontSize=8.2, leading=10.5, textColor=MUTED, alignment=TA_CENTER
        ),
        "notice": ParagraphStyle(
            "n", fontName=body, fontSize=9, leading=12.5, textColor=colors.HexColor("#5b1a12")
        ),
        "cell": ParagraphStyle("cell", fontName=body, fontSize=8.2, leading=10.4, textColor=INK),
        "cellb": ParagraphStyle("cellb", fontName=bold, fontSize=8.2, leading=10.4, textColor=INK),
    }
    return s, body, bold


def _table(rows, widths, styles, header=True, zebra=True):
    s = styles
    data = [
        [Paragraph(str(c), s["cellb"] if header and i == 0 else s["cell"]) for c in row]
        for i, row in enumerate(rows)
    ]
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0, hAlign="LEFT")
    cmds = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, 0), 0.8, INK if header else RULE),
        ("LINEBELOW", (0, 1), (-1, -1), 0.25, RULE),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
    ]
    if zebra:
        for r in range(1, len(rows)):
            if r % 2 == 0:
                cmds.append(("BACKGROUND", (0, r), (-1, r), colors.HexColor("#f6f6f8")))
    t.setStyle(TableStyle(cmds))
    return t


def _notice_box(styles):
    t = Table([[Paragraph("<b>Important.</b> " + NOTICE, styles["notice"])]], colWidths=[170 * mm])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fdf1ee")),
                ("LINEBEFORE", (0, 0), (0, -1), 3, ACCENT),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return t


def _img(path: Path, width_mm: float, max_h_mm: float | None = None):
    from reportlab.lib.utils import ImageReader

    iw, ih = ImageReader(str(path)).getSize()
    w = width_mm * mm
    h = w * ih / iw
    if max_h_mm and h > max_h_mm * mm:
        h = max_h_mm * mm
        w = h * iw / ih
    return Image(str(path), width=w, height=h)


def _fmt(v, nd=1):
    return "–" if v is None else f"{v:,.{nd}f}"


def write_report(summary: dict, out: Path, pdf_path: Path, renders: dict[str, str] | None = None) -> None:
    renders = renders or {}
    s, body_font, bold_font = _styles()
    src = summary["source"]
    lm = summary["landmarks_mm"]
    parts = summary["parts"]
    planes = summary["planes"]

    def on_page(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(RULE)
        canvas.line(20 * mm, 18 * mm, 190 * mm, 18 * mm)
        canvas.setFont(body_font, 6.8)
        canvas.setFillColor(MUTED)
        text = canvas.beginText(20 * mm, 14.5 * mm)
        text.textLine(
            "For education only — not a patient record or surgery report. Anatomy: Human Reference Atlas (HuBMAP), CC BY 4.0."
        )
        text.textLine("Made with MathMe 3D Studio · Human Heart Slice Atlas")
        canvas.drawText(text)
        canvas.drawRightString(190 * mm, 14.5 * mm, f"Page {doc.page}")
        canvas.restoreState()

    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=18 * mm,
        bottomMargin=24 * mm,
        title="Human Heart Slice Atlas",
        author="MathMe 3D Studio",
        subject="Educational anatomy and slice atlas of the HRA reference heart",
    )
    story = []

    # ---------------------------------------------------------------- cover
    story += [
        Paragraph("Human Heart Slice Atlas", s["title"]),
        Paragraph(
            f"{len(planes)} anatomical and cardiac cutting planes through a real, scan-derived human heart, "
            "with 3D files for teaching cardiovascular anatomy and surgery.",
            s["subtitle"],
        ),
        Spacer(1, 6 * mm),
    ]
    if "whole_anterior" in renders:
        story.append(_img(out / renders["whole_anterior"], 120, 120))
        story.append(Paragraph("The reference heart seen from the front (anterior view).", s["caption"]))
    story += [Spacer(1, 5 * mm)]
    n_solid = sum(1 for p in parts if p["closed_solid"])
    story.append(
        _table(
            [
                ["Item", "Details"],
                ["Source model", src["model"]],
                ["Licence", src["license"]],
                ["Structures", f"{len(parts)} named structures ({n_solid} closed solids)"],
                [
                    "Cutting planes",
                    f"{sum(p['group'] == 'anatomical' for p in planes)} anatomical + "
                    f"{sum(p['group'] == 'cardiac' for p in planes)} cardiac views",
                ],
                ["Units and axes", f"{src['units']}. {src['axes']}."],
                ["Made", f"{date.today():%d %B %Y} with MathMe 3D Studio"],
            ],
            [38 * mm, 132 * mm],
            s,
        )
    )
    story += [Spacer(1, 5 * mm), _notice_box(s), PageBreak()]

    # ---------------------------------------------------------------- contents / how to use
    story.append(Paragraph("How to use this atlas and its files", s["h1"]))
    story.append(
        Paragraph(
            "Each cutting plane has a page with a labelled cross-section (like a CT or echo slice), a 3D picture "
            "of one half showing the cut surface, the plane’s exact position and angle, and a table of every "
            "structure it cuts with the cut area. The same data is in <i>planes.json</i> for use in software.",
            s["body"],
        )
    )
    story.append(
        _table(
            [
                ["File", "What it is", "Use it in"],
                [
                    "whole/heart.glb",
                    "Whole heart, one named and coloured part per structure, in metres",
                    "Unity, Unreal, Blender, web viewers, VR",
                ],
                ["whole/heart.obj + .mtl", "Whole heart with colours, in millimetres", "Most 3D programs"],
                ["whole/heart.stl", "Whole heart as one solid, in millimetres", "3D printing (slicers)"],
                [
                    "slices/&lt;plane&gt;.glb",
                    "Both halves of one cut, as two named groups (hide one to see the cut face)",
                    "Teaching apps, VR",
                ],
                [
                    "slices/&lt;plane&gt;_&lt;half&gt;.stl",
                    "One closed half, in millimetres",
                    "3D-printed sliced models",
                ],
                [
                    "images/&lt;plane&gt;.png",
                    "Labelled cross-section with 10 mm scale bar",
                    "Slides, handouts, quizzes",
                ],
                ["planes.json", "Every plane, landmark, structure, area and file name", "Your own software"],
            ],
            [43 * mm, 75 * mm, 52 * mm],
            s,
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("Contents", s["h2"]))
    toc = [["", "Section"]]
    toc += [
        ["1", "Source, licence and accuracy"],
        ["2", "How the planes were made (the maths)"],
        ["3", "The whole heart"],
        ["4", "Structures in the model"],
    ]
    for i, p in enumerate(planes, 1):
        toc.append([f"5.{i}", p["name"]])
    toc.append(["6", "Glossary"])
    story += [_table(toc, [14 * mm, 156 * mm], s), PageBreak()]

    # ---------------------------------------------------------------- 1 source and accuracy
    story.append(Paragraph("1. Source, licence and accuracy", s["h1"]))
    story.append(
        Paragraph(
            "The heart comes from the <b>Human Reference Atlas</b> (HRA) 3D Reference Object Library made by the "
            "HuBMAP consortium. It is the male reference heart (VH_M_Heart, release v1.1), built from the Visible "
            "Human Project male dataset, with each structure modelled as a separate named mesh. It shows the "
            "anatomy of one adult heart, which is real but not the same as every patient’s heart.",
            s["body"],
        )
    )
    story.append(Paragraph(f"Licence: {src['license']} Original files: {src['url']}", s["body"]))
    repaired = [p for p in parts if p["repaired"]]
    open_parts = [p for p in parts if not p["closed_solid"]]
    devs = [p["halves_max_deviation_mm"] for p in parts]
    story.append(Paragraph("What we changed, and how accurate it is", s["h2"]))
    story.append(
        Paragraph(
            f"• The model was converted from metres to millimetres; nothing was moved or reshaped.<br/>"
            f"• {len(repaired)} structures had small holes or open ends (mostly vessels cut off where the model ends). "
            "They were closed with MeshFix so they can be cut with a solid, closed face. The surface area changed "
            "by only a few percent, at the open ends.<br/>"
            f"• {len(open_parts)} structure(s) could not be closed and are cut as open surfaces: "
            f"{', '.join(p['name'] for p in open_parts) or 'none'}.<br/>"
            "• Cross-sections, areas and the whole-heart files use the full-detail model.<br/>"
            "• The cut halves use a lighter copy with fewer triangles so the files stay small. Its surface stays "
            f"within <b>{max(devs):.2f} mm</b> of the full-detail surface (median {sorted(devs)[len(devs) // 2]:.2f} mm), "
            "which is finer than the original scan.",
            s["body"],
        )
    )
    story.append(PageBreak())

    # ---------------------------------------------------------------- 2 method
    story.append(Paragraph("2. How the planes were made (the maths)", s["h1"]))
    story.append(
        Paragraph(
            "Coordinates are in millimetres in the HRA body frame: <b>+x</b> points to the patient’s left, "
            "<b>+y</b> towards the head and <b>+z</b> to the front. Every plane is written as "
            "<b>n · x = d</b>: <b>n</b> is a unit vector at right angles to the plane (its normal) and <b>d</b> is its "
            "distance from the origin along <b>n</b>.",
            s["body"],
        )
    )
    story.append(Paragraph("Landmarks found on the model", s["h2"]))
    story.append(
        _table(
            [
                ["Landmark", "How it is found", "Position (x, y, z) mm"],
                [
                    "Apex",
                    "Point of the left ventricle farthest from the mitral valve centre",
                    ", ".join(f"{v:.1f}" for v in lm["apex"]),
                ],
                [
                    "Mitral valve centre",
                    "Centre (centroid) of the mitral valve mesh",
                    ", ".join(f"{v:.1f}" for v in lm["mitral_valve_centre"]),
                ],
                [
                    "Tricuspid valve centre",
                    "Centroid of the tricuspid valve mesh",
                    ", ".join(f"{v:.1f}" for v in lm["tricuspid_valve_centre"]),
                ],
                [
                    "Aortic valve centre",
                    "Centroid of the aortic valve mesh",
                    ", ".join(f"{v:.1f}" for v in lm["aortic_valve_centre"]),
                ],
                [
                    "Pulmonary valve centre",
                    "Centroid of the pulmonary valve mesh",
                    ", ".join(f"{v:.1f}" for v in lm["pulmonary_valve_centre"]),
                ],
            ],
            [38 * mm, 82 * mm, 50 * mm],
            s,
        )
    )
    u = lm["long_axis_unit"]
    story.append(Paragraph("Plane formulas", s["h2"]))
    for line in [
        f"Long axis: u = (M − A) / |M − A| = ({u[0]:.3f}, {u[1]:.3f}, {u[2]:.3f}), length |M − A| = {lm['apex_to_mitral_mm']:.1f} mm",
        "Plane through three points P, Q, R:  n = (Q − P) × (R − P) / |(Q − P) × (R − P)|,  d = n · P",
        "Four-chamber:  through apex A, mitral M and tricuspid T centres",
        "Three-chamber (LVOT):  through apex A, mitral M and aortic Av centres",
        "Two-chamber:  contains the long axis, at 90° to the four-chamber plane:  n₂ = u × n₄",
        "Short axis at fraction f from the apex:  n = u,  point = A + f · |M − A| · u   (f = 0.25, 0.50, 0.75)",
        "Axial / coronal / sagittal:  n = y / z / x axis, at 1/6 … 5/6 of the heart’s height / depth / width",
        "Angle between the plane normal and a body axis e:  θ = arccos |n · e|",
        "Cut area of a structure:  shoelace formula on its outline,  A = ½ |Σ (xᵢ yᵢ₊₁ − xᵢ₊₁ yᵢ)|",
    ]:
        story.append(Paragraph(line, s["mono"]))
    story.append(
        Paragraph(
            "Each structure is split into two closed halves with the manifold3d geometry library, which also builds "
            "the flat face where the knife went through. The volumes of the two halves always add up to the volume "
            "of the whole structure.",
            s["body"],
        )
    )
    story.append(PageBreak())

    # ---------------------------------------------------------------- 3 whole heart
    story.append(Paragraph("3. The whole heart", s["h1"]))
    cells = []
    for vid, label, _d, _u in WHOLE_VIEWS:
        key = f"whole_{vid}"
        if key in renders:
            cells.append([_img(out / renders[key], 78, 78), Paragraph(label, s["caption"])])
    if cells:
        grid = [[cells[i], cells[i + 1] if i + 1 < len(cells) else ""] for i in range(0, len(cells), 2)]
        t = Table(grid, colWidths=[85 * mm, 85 * mm])
        t.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER"), ("VALIGN", (0, 0), (-1, -1), "TOP")]))
        story.append(t)
    story.append(Paragraph("Colour key", s["h2"]))
    key_rows = [["Colour", "Group", "What it does"]]
    for c in CATEGORIES.values():
        key_rows.append(
            [f'<font color="#{c.color[0]:02x}{c.color[1]:02x}{c.color[2]:02x}">■■■</font>', c.label, c.note]
        )
    story.append(_table(key_rows, [16 * mm, 50 * mm, 104 * mm], s))
    story.append(PageBreak())

    # ---------------------------------------------------------------- 4 structures
    story.append(Paragraph("4. Structures in the model", s["h1"]))
    story.append(
        Paragraph(
            "Volume and surface area are of each structure’s mesh as modelled (for chambers this is the wall, "
            "not the blood inside). They describe the reference model and are not clinical measurements.",
            s["small"],
        )
    )
    rows = [["Structure", "Group", "Volume (mL)", "Surface (cm²)", "Size (mm)"]]
    for p in sorted(parts, key=lambda p: (p["category"], p["name"])):
        vol = None if p["volume_mm3"] is None else p["volume_mm3"] / 1000
        rows.append(
            [
                p["name"],
                p["category"],
                _fmt(vol, 2),
                _fmt(p["surface_area_mm2"] / 100, 1),
                " × ".join(f"{v:.0f}" for v in p["size_mm"]),
            ]
        )
    story.append(_table(rows, [58 * mm, 40 * mm, 22 * mm, 22 * mm, 28 * mm], s))
    story.append(Paragraph("What each structure does", s["h2"]))
    for cat in CATEGORIES.values():
        members = [p for p in parts if p["category"] == cat.label and p["note"]]
        if not members:
            continue
        story.append(CondPageBreak(30 * mm))
        story.append(Paragraph(f"<b>{cat.label}.</b> {cat.note}", s["body"]))
        for p in members:
            story.append(Paragraph(f"• <b>{p['name']}</b>: {p['note']}", s["body"]))
    story.append(PageBreak())

    # ---------------------------------------------------------------- 5 slices
    for i, p in enumerate(planes, 1):
        story.append(Paragraph(f"5.{i} {p['name']}", s["h1"]))
        story.append(Paragraph(p["teaches"], s["body"]))
        img = out / p["files"]["image"]
        cut = renders.get(f"{p['id']}_cut")
        left = [
            _img(img, 112, 112),
            Paragraph(
                "Labelled cross-section (10 mm scale bar, arrows show head, front and left).", s["caption"]
            ),
        ]
        right = []
        if cut:
            right = [
                _img(out / cut, 56, 56),
                Paragraph(f"3D view of the {p['halves'][1]} half, looking at the cut face.", s["caption"]),
            ]
        t = Table([[left, right]], colWidths=[116 * mm, 58 * mm])
        t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0)]))
        story.append(t)
        ang = p["angles_to_body_axes_deg"]
        story.append(
            KeepTogether(
                [
                    Paragraph("Where the cut is", s["h2"]),
                    _table(
                        [
                            ["Plane equation (mm)", p["equation"]],
                            ["Point on plane", ", ".join(f"{v:.1f}" for v in p["point"])],
                            ["Normal n", ", ".join(f"{v:.3f}" for v in p["normal"])],
                            ["Angle to body axes", "; ".join(f"{k}: {v:.0f}°" for k, v in ang.items())],
                            ["Halves", f"{p['halves'][0]} (side n points to) and {p['halves'][1]}"],
                            [
                                "Files",
                                f"{p['files']['glb_both_halves']}, {', '.join(p['files']['stl'].values())}, {p['files']['image']}",
                            ],
                        ],
                        [38 * mm, 132 * mm],
                        s,
                        header=False,
                    ),
                ]
            )
        )
        cut_rows = [["Structure cut", "Cut area (mm²)", "Outline length (mm)"]]
        for c in p["structures_cut"]:
            cut_rows.append([c["name"], _fmt(c["area_mm2"]), _fmt(c["perimeter_mm"])])
        story.append(Paragraph(f"Structures cut ({len(p['structures_cut'])})", s["h2"]))
        story.append(_table(cut_rows, [90 * mm, 40 * mm, 40 * mm], s))
        if p["open_cut_parts"]:
            story.append(
                Paragraph(
                    "Cut as open surfaces (no closed face): " + ", ".join(p["open_cut_parts"]), s["small"]
                )
            )
        story.append(PageBreak())

    # ---------------------------------------------------------------- 6 glossary
    story.append(Paragraph("6. Glossary", s["h1"]))
    gloss = [
        ("Anterior / posterior", "Towards the front / back of the body."),
        ("Superior / inferior", "Towards the head / feet."),
        ("Axial (transverse) plane", "A horizontal cut, like a CT slice."),
        ("Coronal plane", "A vertical cut that separates front from back."),
        ("Sagittal plane", "A vertical cut that separates left from right."),
        ("Long axis", "The line from the apex of the left ventricle to the centre of the mitral valve."),
        ("Short axis", "A cut at right angles to the long axis, showing the ventricles as rings."),
        ("Apex", "The tip of the heart, formed by the left ventricle."),
        ("Base", "The top of the heart where the valves and great vessels are."),
        ("LVOT", "Left ventricular outflow tract: the path from the left ventricle to the aortic valve."),
        ("Atrioventricular (AV) valves", "The mitral and tricuspid valves, between atria and ventricles."),
        ("Semilunar valves", "The aortic and pulmonary valves, at the exits of the ventricles."),
        (
            "Chordae tendineae",
            "Thin cords joining valve leaflets to papillary muscles (too fine to be in this model).",
        ),
        ("Normal (of a plane)", "A unit vector at right angles to the plane."),
        (
            "Closed solid (watertight)",
            "A mesh with no holes, so it has an inside and a volume and can be 3D printed.",
        ),
        (
            "GLB / STL / OBJ",
            "3D file formats: GLB keeps names and colours; STL is for 3D printing; OBJ is widely supported.",
        ),
    ]
    story.append(_table([["Term", "Meaning"]] + [list(g) for g in gloss], [50 * mm, 120 * mm], s))
    story += [Spacer(1, 6 * mm), _notice_box(s)]
    story.append(Spacer(1, 4 * mm))
    story.append(
        Paragraph(
            "Attribution: 3D reference heart from the Human Reference Atlas, HuBMAP consortium, licensed under "
            "CC BY 4.0. Processing, cutting planes and this atlas: MathMe 3D Studio.",
            s["small"],
        )
    )
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
