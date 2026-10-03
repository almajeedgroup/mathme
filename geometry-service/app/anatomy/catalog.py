"""Plain-language names, colours and teaching notes for each part of the HRA heart model.

The notes are general, textbook-level anatomy for teaching. They are not clinical advice and
should be reviewed by a qualified cardiothoracic surgeon before being used in a course.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Category:
    key: str
    label: str
    color: tuple[int, int, int]
    note: str


CATEGORIES: dict[str, Category] = {
    c.key: c
    for c in [
        Category(
            "left_heart",
            "Left heart chambers",
            (196, 52, 62),
            "The left atrium and left ventricle carry oxygen-rich blood from the lungs to the body.",
        ),
        Category(
            "right_heart",
            "Right heart chambers",
            (84, 104, 196),
            "The right atrium and right ventricle carry oxygen-poor blood from the body to the lungs.",
        ),
        Category(
            "muscle",
            "Septum and papillary muscles",
            (163, 72, 66),
            "Heart muscle that divides the ventricles and anchors the valve leaflets.",
        ),
        Category(
            "valve",
            "Heart valves",
            (236, 222, 186),
            "One-way valves that keep blood moving forward through the heart.",
        ),
        Category(
            "aorta",
            "Aorta and its branches",
            (214, 54, 54),
            "The main artery leaving the left ventricle and the large arteries that branch from its arch.",
        ),
        Category(
            "coronary_artery",
            "Coronary arteries",
            (255, 92, 60),
            "Small arteries on the heart surface that supply the heart muscle itself.",
        ),
        Category(
            "pulmonary_artery",
            "Pulmonary arteries",
            (61, 111, 214),
            "Carry oxygen-poor blood from the right ventricle to the lungs.",
        ),
        Category(
            "pulmonary_vein",
            "Pulmonary veins",
            (224, 106, 122),
            "Carry oxygen-rich blood from the lungs back to the left atrium.",
        ),
        Category(
            "systemic_vein",
            "Venae cavae and great veins",
            (47, 79, 168),
            "Bring oxygen-poor blood from the body back to the right atrium.",
        ),
        Category(
            "coronary_vein",
            "Cardiac veins",
            (80, 70, 190),
            "Drain blood from the heart muscle, mostly into the coronary sinus and then the right atrium.",
        ),
    ]
}


@dataclass(frozen=True)
class PartInfo:
    name: str
    category: str
    note: str


# name in the model (without the "VH_M_" prefix) -> plain name, category, teaching note
_PARTS: dict[str, tuple[str, str, str]] = {
    "left_cardiac_atrium": (
        "Left atrium",
        "left_heart",
        "Receives oxygen-rich blood from the four pulmonary veins and passes it through the mitral valve to "
        "the left ventricle. It is the most posterior chamber, lying just in front of the oesophagus, which is "
        "why surgeons often reach the mitral valve through the left atrium.",
    ),
    "heart_left_ventricle": (
        "Left ventricle",
        "left_heart",
        "The main pumping chamber. Its thick muscular wall pushes blood through the aortic valve into the "
        "aorta. It forms the apex (tip) of the heart.",
    ),
    "right_cardiac_atrium": (
        "Right atrium",
        "right_heart",
        "Receives oxygen-poor blood from the superior and inferior venae cavae and from the coronary sinus, "
        "and passes it through the tricuspid valve to the right ventricle.",
    ),
    "heart_right_ventricle": (
        "Right ventricle",
        "right_heart",
        "A crescent-shaped chamber wrapped around the front of the left ventricle. It pumps blood through the "
        "pulmonary valve into the pulmonary trunk. It is the most anterior chamber, just behind the sternum.",
    ),
    "interventricular_septum": (
        "Interventricular septum",
        "muscle",
        "The wall between the two ventricles. A hole in it (ventricular septal defect) is one of the most "
        "common congenital heart defects.",
    ),
    "papillary_muscle_of_heart_anterolateral": (
        "Anterolateral papillary muscle (LV)",
        "muscle",
        "Left-ventricle papillary muscle; its chordae tendineae tether both mitral leaflets.",
    ),
    "papillary_muscle_of_heart_posteromedial": (
        "Posteromedial papillary muscle (LV)",
        "muscle",
        "Left-ventricle papillary muscle; usually supplied by a single coronary artery, so it is more "
        "vulnerable to rupture after a heart attack.",
    ),
    "papillary_muscle_of_heart_anterior": (
        "Anterior papillary muscle (RV)",
        "muscle",
        "The largest right-ventricle papillary muscle, anchoring the tricuspid leaflets.",
    ),
    "papillary_muscle_of_heart_posterior": (
        "Posterior papillary muscle (RV)",
        "muscle",
        "Right-ventricle papillary muscle anchoring the tricuspid leaflets.",
    ),
    "papillary_muscle_of_heart_medial": (
        "Medial (septal) papillary muscle (RV)",
        "muscle",
        "Small right-ventricle papillary muscle near the septum.",
    ),
    "mitral_valve": (
        "Mitral valve",
        "valve",
        "Two-leaflet (anterior and posterior) valve between the left atrium and left ventricle. Mitral repair "
        "or replacement is one of the most common valve operations.",
    ),
    "tricuspid_valve": (
        "Tricuspid valve",
        "valve",
        "Three-leaflet valve between the right atrium and right ventricle.",
    ),
    "aortic_valve": (
        "Aortic valve",
        "valve",
        "Three semilunar cusps between the left ventricle and the aorta. The coronary arteries start just above "
        "the right and left cusps.",
    ),
    "pulmonary_valve": (
        "Pulmonary valve",
        "valve",
        "Three semilunar cusps between the right ventricle outflow tract and the pulmonary trunk.",
    ),
    "ascending_aorta": (
        "Ascending aorta",
        "aorta",
        "First part of the aorta, rising from the aortic valve. Cannulated or cross-clamped during many "
        "operations that use cardiopulmonary bypass.",
    ),
    "aortic_arch": (
        "Aortic arch",
        "aorta",
        "Curves over the left pulmonary artery and gives off three branches.",
    ),
    "descending_aorta_a": (
        "Descending aorta (upper)",
        "aorta",
        "Continues the aorta down through the chest.",
    ),
    "descending_aorta_b": (
        "Descending aorta (lower)",
        "aorta",
        "Continues the aorta down through the chest.",
    ),
    "brachiocephalic_artery_a": (
        "Brachiocephalic artery",
        "aorta",
        "First branch of the arch; divides into the right subclavian and right common carotid arteries.",
    ),
    "brachiocephalic_artery_b": (
        "Brachiocephalic artery (branches)",
        "aorta",
        "Branches of the brachiocephalic artery.",
    ),
    "left_common_carotid_artery_a": (
        "Left common carotid artery",
        "aorta",
        "Second branch of the arch; supplies the head.",
    ),
    "left_common_carotid_artery_b": (
        "Left common carotid artery (upper)",
        "aorta",
        "Continues up to the head.",
    ),
    "left_subclavian_artery_a": (
        "Left subclavian artery",
        "aorta",
        "Third branch of the arch; supplies the left arm.",
    ),
    "left_subclavian_artery_b": (
        "Left subclavian artery (distal)",
        "aorta",
        "Continues towards the left arm.",
    ),
    "left_coronary_artery": (
        "Left main coronary artery",
        "coronary_artery",
        "Arises from the left aortic sinus and divides into the left anterior descending and circumflex arteries.",
    ),
    "left_anterior_descending_artery": (
        "Left anterior descending artery (LAD)",
        "coronary_artery",
        "Runs down the front of the heart in the anterior interventricular groove. It supplies much of the left "
        "ventricle and septum, and is the most common target for bypass grafting.",
    ),
    "diagonal_branch_of_left_anterior_descending_artery": (
        "Diagonal branch of LAD",
        "coronary_artery",
        "Branch of the LAD supplying the front-side wall of the left ventricle.",
    ),
    "diagonal_branch_of_anterior_descending_branch_of_left_coronary_artery": (
        "Second diagonal branch of LAD",
        "coronary_artery",
        "Further diagonal branch of the LAD.",
    ),
    "left_marginal_branch": (
        "Obtuse marginal branch",
        "coronary_artery",
        "Branch of the circumflex artery running along the left border of the heart.",
    ),
    "right_coronary_artery": (
        "Right coronary artery (RCA)",
        "coronary_artery",
        "Arises from the right aortic sinus and runs in the groove between the right atrium and right ventricle.",
    ),
    "right_marginal_artery": (
        "Right marginal artery",
        "coronary_artery",
        "Branch of the RCA along the lower right border of the heart.",
    ),
    "right_posterior_descending_artery": (
        "Posterior descending artery (PDA)",
        "coronary_artery",
        "Runs in the posterior interventricular groove; comes from the RCA in most people (right dominance).",
    ),
    "pulmonary_trunk": (
        "Pulmonary trunk",
        "pulmonary_artery",
        "Leaves the right ventricle and divides into the left and right pulmonary arteries.",
    ),
    "pulmonary_artery_L": ("Left pulmonary artery", "pulmonary_artery", "Carries blood to the left lung."),
    "pulmonary_artery_R": ("Right pulmonary artery", "pulmonary_artery", "Carries blood to the right lung."),
    "pulmonary_vein_L_sup": ("Left superior pulmonary vein", "pulmonary_vein", "Drains the upper left lung."),
    "pulmonary_vein_L_inf": ("Left inferior pulmonary vein", "pulmonary_vein", "Drains the lower left lung."),
    "pulmonary_vein_R_sup": (
        "Right superior pulmonary vein",
        "pulmonary_vein",
        "Drains the upper right lung.",
    ),
    "pulmonary_vein_R_inf": (
        "Right inferior pulmonary vein",
        "pulmonary_vein",
        "Drains the lower right lung.",
    ),
    "superior_vena_cava": (
        "Superior vena cava",
        "systemic_vein",
        "Returns blood from the head, neck and arms to the right atrium; a common site for venous cannulation.",
    ),
    "inferior_vena_cava_a": (
        "Inferior vena cava (upper)",
        "systemic_vein",
        "Returns blood from the lower body to the right atrium.",
    ),
    "inferior_vena_cava_b": (
        "Inferior vena cava (lower)",
        "systemic_vein",
        "Continues down into the abdomen.",
    ),
    "brachiocephalic_vein_L": (
        "Left brachiocephalic vein",
        "systemic_vein",
        "Joins the right one to form the SVC.",
    ),
    "brachiocephalic_vein_R": (
        "Right brachiocephalic vein",
        "systemic_vein",
        "Joins the left one to form the SVC.",
    ),
    "coronary_sinus": (
        "Coronary sinus",
        "coronary_vein",
        "Large vein in the posterior groove between the left atrium and ventricle; drains most cardiac veins "
        "into the right atrium. Used for retrograde cardioplegia.",
    ),
    "great_cardiac_vein": (
        "Great cardiac vein",
        "coronary_vein",
        "Runs beside the LAD and drains into the coronary sinus.",
    ),
    "middle_cardiac_vein": ("Middle cardiac vein", "coronary_vein", "Runs beside the PDA."),
    "small_cardiac_vein": ("Small cardiac vein", "coronary_vein", "Runs beside the right coronary artery."),
    "posterior_vein_of_left_ventricle": (
        "Posterior vein of the LV",
        "coronary_vein",
        "Drains the back of the left ventricle.",
    ),
    "oblique_vein_of_left_atrium": (
        "Oblique vein of the left atrium",
        "coronary_vein",
        "Small vein on the back of the left atrium.",
    ),
    "anterior_cardiac_vein": (
        "Anterior cardiac vein",
        "coronary_vein",
        "Drains the front of the right ventricle.",
    ),
}

# The "heart proper": used to place planes (the long vessels are left out).
CORE_PARTS = {
    "left_cardiac_atrium",
    "heart_left_ventricle",
    "right_cardiac_atrium",
    "heart_right_ventricle",
    "interventricular_septum",
    "mitral_valve",
    "tricuspid_valve",
    "aortic_valve",
    "pulmonary_valve",
}


def part_info(key: str) -> PartInfo:
    """Plain name, category and teaching note for a model part (key without the 'VH_M_' prefix)."""
    if key in _PARTS:
        name, cat, note = _PARTS[key]
        return PartInfo(name, cat, note)
    return PartInfo(key.replace("_", " ").capitalize(), "muscle", "")


def color_of(key: str) -> tuple[int, int, int]:
    return CATEGORIES[part_info(key).category].color
