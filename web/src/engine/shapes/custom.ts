import {
  BufferAttribute,
  BufferGeometry,
  ExtrudeGeometry,
  LatheGeometry,
  PlaneGeometry,
  Shape,
  Vector2,
} from 'three';
import { FontLoader, type Font } from 'three/addons/loaders/FontLoader.js';
import { ParametricGeometry } from 'three/addons/geometries/ParametricGeometry.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

import fontJson from '../../assets/fonts/droid_sans_bold.ascii.typeface.json';
import { decodeFloat32, decodeUint32 } from '../binary';
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
    g.setAttribute('position', new BufferAttribute(decodeFloat32(stored.positions), 3));
    g.setIndex(new BufferAttribute(decodeUint32(stored.indices), 1));
    // sharp edges stay sharp, curved parts stay smooth
    return toCreasedNormals(g, Math.PI / 6);
  },
};
