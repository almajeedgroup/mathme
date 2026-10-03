import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  type Curve,
  CurvePath,
  ExtrudeGeometry,
  LineCurve3,
  SphereGeometry,
  TubeGeometry,
  Vector3,
  LatheGeometry,
  PlaneGeometry,
  Shape,
  Vector2,
} from 'three';
import { FontLoader, type Font } from 'three/addons/loaders/FontLoader.js';
import { ParametricGeometry } from 'three/addons/geometries/ParametricGeometry.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

import fontJson from '../../assets/fonts/droid_sans_bold.ascii.typeface.json';
import { decodeFloat32, decodeUint32 } from '../binary';
import { getMeshData } from '../meshAssets';
import { compileFormula, evalConstant } from '../expr';
import { bool, num, points, str, type TextField } from '../fields';
import { fmt } from '../math';
import type { Params, Vec2 } from '../types';
import { lengthField, smoothnessField } from './fieldKit';
import { LATHE_PRESETS, OUTLINE_PRESETS, PARAMETRIC_PRESETS, signedArea } from './profiles';
import type { FormulaLine, ShapeDefinition } from './types';

const PI = Math.PI;

// ---------------------------------------------------------------- lathe (spun profile)

/** Clean up a lathe profile: no negative radii, and wound so faces point outwards. */
export function normalizeLatheProfile(raw: Vec2[]): Vec2[] {
  const pts = raw.map(([r, y]) => [Math.max(0, r), y] as Vec2);
  if (pts.length >= 3 && latheIsClosed(pts) && signedArea(pts) < 0) pts.reverse();
  return pts;
}

export function latheIsClosed(pts: Vec2[]): boolean {
  return pts.length >= 3 && pts[0][0] < 1e-6 && pts[pts.length - 1][0] < 1e-6;
}

export const lathe: ShapeDefinition = {
  type: 'lathe',
  label: 'Spun shape',
  description:
    'Draw half of an outline and spin it around the middle line, like clay on a potter’s wheel (vases, bowls, goblets).',
  icon: '🏺',
  category: 'custom',
  fields: [
    {
      kind: 'points',
      key: 'profile',
      label: 'Side outline',
      help: 'Points of half the outline: across = distance from the middle line, up = height.',
      mode: 'profile',
    },
    smoothnessField({ min: 6, max: 96 }),
  ],
  defaults: { profile: LATHE_PRESETS[0].points, smoothness: 48 },
  build: (p) => {
    const pts = normalizeLatheProfile(points(p, 'profile'));
    if (pts.length < 2) return new BufferGeometry();
    const g = new LatheGeometry(
      pts.map(([r, y]) => new Vector2(r, y)),
      Math.round(num(p, 'smoothness', 48)),
    );
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    g.translate(0, -(bb.min.y + bb.max.y) / 2, 0);
    return g;
  },
  formulas: (p) => {
    const pts = normalizeLatheProfile(points(p, 'profile'));
    if (pts.length < 2) return [];
    let volume = 0;
    let area = 0;
    for (let i = 0; i + 1 < pts.length; i++) {
      const [r1, y1] = pts[i];
      const [r2, y2] = pts[i + 1];
      volume += (PI * (y2 - y1) * (r1 * r1 + r1 * r2 + r2 * r2)) / 3;
      area += PI * (r1 + r2) * Math.hypot(r2 - r1, y2 - y1);
    }
    const lines: FormulaLine[] = [
      {
        quantity: 'Surface area',
        formula: 'A = Σ π × (r₁ + r₂) × s   (one band per slice)',
        working: `${pts.length - 1} slices added up`,
        value: area,
        power: 2,
      },
    ];
    if (latheIsClosed(pts)) {
      lines.unshift({
        quantity: 'Volume',
        formula: 'V = Σ ⅓ × π × h × (r₁² + r₁×r₂ + r₂²)   (one frustum per slice)',
        working: `${pts.length - 1} frustum slices added up`,
        value: Math.abs(volume),
        power: 3,
      });
    }
    return lines;
  },
};

// ---------------------------------------------------------------- extrude (pushed-out outline)

export const extrude: ShapeDefinition = {
  type: 'extrude',
  label: 'Extruded shape',
  description: 'Draw a flat outline (a star, a heart, a letter…) and push it out to give it thickness.',
  icon: '⭐',
  category: 'custom',
  fields: [
    {
      kind: 'points',
      key: 'outline',
      label: 'Outline',
      help: 'The corners of the flat shape, in order around the edge.',
      mode: 'outline',
    },
    lengthField('depth', 'Thickness', 'How far the outline is pushed out.', {
      min: 0.05,
      aliases: ['depth'],
    }),
    { kind: 'boolean', key: 'bevel', label: 'Rounded edges', help: 'Smooth off the sharp edges a little.' },
    lengthField('bevelSize', 'Edge rounding', 'How much the edges are rounded.', {
      min: 0.01,
      max: 1,
      step: 0.01,
      visibleIf: (p) => bool(p, 'bevel'),
    }),
  ],
  defaults: { outline: OUTLINE_PRESETS[0].points, depth: 0.6, bevel: false, bevelSize: 0.1 },
  build: (p) => {
    const pts = points(p, 'outline');
    if (pts.length < 3) return new BufferGeometry();
    const shape = new Shape(pts.map(([x, y]) => new Vector2(x, y)));
    const bevel = bool(p, 'bevel');
    const bevelSize = num(p, 'bevelSize', 0.1);
    const g = new ExtrudeGeometry(shape, {
      depth: num(p, 'depth', 0.6),
      bevelEnabled: bevel,
      bevelSize,
      bevelThickness: bevelSize,
      bevelSegments: 3,
      curveSegments: 12,
    });
    g.center();
    return g;
  },
  formulas: (p) => {
    const pts = points(p, 'outline');
    if (pts.length < 3) return [];
    const area = Math.abs(signedArea(pts));
    const d = num(p, 'depth');
    let perimeter = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      perimeter += Math.hypot(x2 - x1, y2 - y1);
    }
    const approx = bool(p, 'bevel') ? ' (about, ignoring rounded edges)' : '';
    return [
      {
        quantity: 'Outline area',
        formula: 'A = ½ × |Σ (xᵢ × yᵢ₊₁ − xᵢ₊₁ × yᵢ)|   (shoelace formula)',
        working: `${pts.length} corners`,
        value: area,
        power: 2,
      },
      {
        quantity: `Volume${approx}`,
        formula: 'V = outline area × thickness',
        working: `V = ${fmt(area)} × ${fmt(d)}`,
        value: area * d,
        power: 3,
      },
      {
        quantity: `Surface area${approx}`,
        formula: 'S = 2 × outline area + perimeter × thickness',
        working: `S = 2 × ${fmt(area)} + ${fmt(perimeter)} × ${fmt(d)}`,
        value: 2 * area + perimeter * d,
        power: 2,
      },
    ];
  },
};

// ---------------------------------------------------------------- tube (3D pen line)

function tubeCurve(pts: Vec2[], smooth: boolean, closed: boolean): Curve<Vector3> {
  const v = pts.map(([x, y]) => new Vector3(x, y, 0));
  if (smooth && v.length > 2) return new CatmullRomCurve3(v, closed, 'centripetal');
  const path = new CurvePath<Vector3>();
  const ends = closed ? [...v, v[0]] : v;
  for (let i = 0; i + 1 < ends.length; i++) path.add(new LineCurve3(ends[i], ends[i + 1]));
  return path;
}

/** Length of the line the tube follows. */
export function tubeLength(params: Params): number {
  const pts = points(params, 'path');
  if (pts.length < 2) return 0;
  return tubeCurve(pts, bool(params, 'smooth'), bool(params, 'closed')).getLength();
}

export const tube: ShapeDefinition = {
  type: 'tube',
  label: '3D pen line',
  description: 'A round tube that follows a line, like drawing in the air with a 3D pen.',
  icon: '🖊️',
  category: 'custom',
  fields: [
    {
      kind: 'points',
      key: 'path',
      label: 'Line',
      help: 'The points the tube passes through, from start to end.',
      mode: 'path',
    },
    lengthField('radius', 'Tube radius', 'Half the thickness of the tube.', {
      min: 0.02,
      max: 5,
      step: 0.05,
      aliases: ['radius', 'width'],
    }),
    { kind: 'boolean', key: 'smooth', label: 'Smooth curve', help: 'Bend smoothly through the points.' },
    { kind: 'boolean', key: 'closed', label: 'Join the ends', help: 'Make a loop, like a ring.' },
  ],
  defaults: {
    path: [
      [-3, 0],
      [-1.5, 1.5],
      [0, 0],
      [1.5, -1.5],
      [3, 0],
    ],
    radius: 0.25,
    smooth: true,
    closed: false,
  },
  build: (p) => {
    const pts = points(p, 'path');
    if (pts.length < 2) return new BufferGeometry();
    const r = num(p, 'radius', 0.25);
    const closed = bool(p, 'closed') && pts.length > 2;
    const curve = tubeCurve(pts, bool(p, 'smooth'), closed);
    const segments = Math.min(1200, Math.max(24, Math.round((curve.getLength() / r) * 3)));
    const body = new TubeGeometry(curve, segments, r, 16, closed);
    if (closed) {
      body.center();
      return body;
    }
    // round caps so the tube is a closed solid (good for 3D printing and for its volume)
    const caps = [curve.getPoint(0), curve.getPoint(1)].map((c) => {
      const cap = new SphereGeometry(r, 16, 12);
      cap.translate(c.x, c.y, c.z);
      return cap;
    });
    const g = mergeGeometries([body, ...caps]) ?? body;
    g.center();
    return g;
  },
  formulas: (p) => {
    const r = num(p, 'radius', 0.25);
    const L = tubeLength(p);
    if (!L) return [];
    const open = !(bool(p, 'closed') && points(p, 'path').length > 2);
    return [
      {
        quantity: 'Length of the line',
        formula: 'L = the sum of the lengths of all the little pieces',
        working: `L ≈ ${fmt(L)}`,
        value: L,
        power: 1,
      },
      {
        quantity: 'Volume',
        formula: open
          ? 'V = π × r² × L + 4/3 × π × r³   (a cylinder plus two half-ball ends)'
          : 'V = π × r² × L',
        working: open
          ? `V = π × ${fmt(r)}² × ${fmt(L)} + 4/3 × π × ${fmt(r)}³`
          : `V = π × ${fmt(r)}² × ${fmt(L)}`,
        value: PI * r * r * L + (open ? (4 / 3) * PI * r ** 3 : 0),
        power: 3,
      },
      {
        quantity: 'Surface area',
        formula: open ? 'S = 2 × π × r × L + 4 × π × r²' : 'S = 2 × π × r × L',
        working: open
          ? `S = 2 × π × ${fmt(r)} × ${fmt(L)} + 4 × π × ${fmt(r)}²`
          : `S = 2 × π × ${fmt(r)} × ${fmt(L)}`,
        value: 2 * PI * r * L + (open ? 4 * PI * r * r : 0),
        power: 2,
      },
    ];
  },
};

// ---------------------------------------------------------------- 3D text

let font: Font | null = null;
function getFont(): Font {
  font ??= new FontLoader().parse(fontJson as unknown as Parameters<FontLoader['parse']>[0]);
  return font;
}

export const text3d: ShapeDefinition = {
  type: 'text3d',
  label: '3D text',
  description: 'Letters and numbers with thickness. Write your name in 3D!',
  icon: '🔤',
  category: 'custom',
  fields: [
    { kind: 'text', key: 'text', label: 'Text', help: 'What to write (letters, numbers and symbols).' },
    lengthField('size', 'Letter height', 'How tall the capital letters are.', { aliases: ['size'] }),
    lengthField('depth', 'Thickness', 'How thick the letters are.', { min: 0.05, aliases: ['depth'] }),
    { kind: 'boolean', key: 'bevel', label: 'Rounded edges', help: 'Smooth off the sharp edges a little.' },
  ],
  defaults: { text: 'MathMe', size: 2, depth: 0.5, bevel: false },
  build: (p) => {
    const text =
      str(p, 'text', 'MathMe')
        .replace(/[^\x20-\x7e]/g, '?')
        .slice(0, 60) || ' ';
    const size = num(p, 'size', 2);
    const g = new TextGeometry(text, {
      font: getFont(),
      size,
      depth: num(p, 'depth', 0.5),
      curveSegments: 6,
      bevelEnabled: bool(p, 'bevel'),
      bevelThickness: size * 0.03,
      bevelSize: size * 0.02,
      bevelSegments: 2,
    });
    g.center();
    return g;
  },
};

// ---------------------------------------------------------------- graph surface y = f(x, z)

export const graphSurface: ShapeDefinition = {
  type: 'graphSurface',
  label: 'Graph surface',
  description: 'Type a formula y = f(x, z) and see it as a 3D landscape. Height (y) depends on x and z.',
  icon: '🏔️',
  category: 'custom',
  open: true,
  fields: [
    {
      kind: 'text',
      key: 'formula',
      label: 'y =',
      help: 'A formula using x and z, e.g. sin(x) * cos(z). You can use + − * / ^, pi and sin, cos, sqrt…',
      formulaVars: ['x', 'z'],
    },
    lengthField('size', 'Size', 'Width of the square area: x and z go from −size/2 to +size/2.', {
      min: 1,
      max: 40,
      aliases: ['size', 'width'],
    }),
    {
      kind: 'number',
      key: 'heightScale',
      label: 'Height stretch',
      help: 'Multiply every height by this number to make hills taller or flatter.',
      unit: 'factor',
      min: 0,
      max: 5,
      step: 0.1,
    },
    smoothnessField({ key: 'resolution', label: 'Detail', min: 4, max: 200 }),
  ],
  defaults: { formula: 'sin(x) * cos(z)', size: 10, heightScale: 1, resolution: 64 },
  build: (p) => {
    const size = num(p, 'size', 10);
    const res = Math.round(num(p, 'resolution', 64));
    const scale = num(p, 'heightScale', 1);
    const g = new PlaneGeometry(size, size, res, res);
    g.rotateX(-PI / 2);
    const compiled = compileFormula(str(p, 'formula'), ['x', 'z']);
    const pos = g.getAttribute('position');
    if (compiled.ok) {
      const scope = { x: 0, z: 0 };
      for (let i = 0; i < pos.count; i++) {
        scope.x = pos.getX(i);
        scope.z = pos.getZ(i);
        pos.setY(i, compiled.fn(scope) * scale);
      }
      pos.needsUpdate = true;
    }
    g.computeVertexNormals();
    return g;
  },
};

// ---------------------------------------------------------------- parametric surface

function range(p: Params, key: string, fallback: number): number {
  const v = p[key];
  if (typeof v === 'number') return v;
  const n = evalConstant(String(v ?? ''));
  return Number.isFinite(n) ? n : fallback;
}

const uvVars = ['u', 'v'];
const formulaField = (key: string, label: string): TextField => ({
  kind: 'text',
  key,
  label,
  help: `Formula for ${key} using u and v.`,
  formulaVars: uvVars,
});
const rangeField = (key: string, label: string): TextField => ({
  kind: 'text',
  key,
  label,
  help: 'A number or expression like 2*pi.',
  formulaVars: [],
});

export const parametric: ShapeDefinition = {
  type: 'parametric',
  label: 'Parametric surface',
  description:
    'Advanced: give formulas for x, y and z using two sliders u and v. Makes Möbius strips, shells and more.',
  icon: '🐚',
  category: 'custom',
  open: true,
  fields: [
    formulaField('x', 'x ='),
    formulaField('y', 'y ='),
    formulaField('z', 'z ='),
    rangeField('uMin', 'u from'),
    rangeField('uMax', 'u to'),
    rangeField('vMin', 'v from'),
    rangeField('vMax', 'v to'),
    {
      kind: 'number',
      key: 'scale',
      label: 'Zoom',
      help: 'Make the whole surface bigger or smaller.',
      unit: 'factor',
      min: 0.1,
      max: 5,
      step: 0.1,
      aliases: ['size'],
    },
    smoothnessField({ key: 'resolution', label: 'Detail', min: 4, max: 200 }),
  ],
  defaults: { ...PARAMETRIC_PRESETS[0].params, scale: 1, resolution: 96 },
  build: (p) => {
    const fx = compileFormula(str(p, 'x'), uvVars);
    const fy = compileFormula(str(p, 'y'), uvVars);
    const fz = compileFormula(str(p, 'z'), uvVars);
    const u0 = range(p, 'uMin', 0),
      u1 = range(p, 'uMax', 1);
    const v0 = range(p, 'vMin', 0),
      v1 = range(p, 'vMax', 1);
    const s = num(p, 'scale', 1);
    const res = Math.round(num(p, 'resolution', 96));
    const scope = { u: 0, v: 0 };
    const g = new ParametricGeometry(
      (a, b, target) => {
        scope.u = u0 + a * (u1 - u0);
        scope.v = v0 + b * (v1 - v0);
        target.set(fx.ok ? fx.fn(scope) * s : 0, fy.ok ? fy.fn(scope) * s : 0, fz.ok ? fz.fn(scope) * s : 0);
      },
      res,
      res,
    );
    return g;
  },
};

// ---------------------------------------------------------------- stored mesh (Combine / Cut results)

export const mesh: ShapeDefinition = {
  type: 'mesh',
  label: 'Combined shape',
  description: 'A shape made by combining or cutting other shapes.',
  icon: '🧩',
  category: 'custom',
  hidden: true,
  fields: [],
  defaults: { meshId: '' },
  build: (p, ctx) => {
    const stored = ctx.meshes.find((m) => m.id === str(p, 'meshId'));
    const g = new BufferGeometry();
    if (!stored) return g;
    // library meshes are loaded from a file at run time; inline ones are stored in the project
    const data = stored.positions
      ? { positions: decodeFloat32(stored.positions), indices: decodeUint32(stored.indices) }
      : getMeshData(stored.id);
    if (!data) return g;
    g.setAttribute('position', new BufferAttribute(data.positions, 3));
    g.setIndex(new BufferAttribute(data.indices, 1));
    // sharp edges stay sharp, curved parts stay smooth
    return toCreasedNormals(g, Math.PI / 6);
  },
};
