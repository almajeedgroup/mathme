import {
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  OctahedronGeometry,
  TetrahedronGeometry,
  TorusKnotGeometry,
} from 'three';

import { num } from '../fields';
import { fmt } from '../math';
import { lengthField, smoothnessField } from './fieldKit';
import type { FormulaLine, ShapeDefinition } from './types';

const PI = Math.PI;
const SQRT5 = Math.sqrt(5);

export const pyramid: ShapeDefinition = {
  type: 'pyramid',
  label: 'Pyramid',
  description: 'A square base with four triangle sides that meet at a point, like the pyramids of Egypt.',
  icon: '🔺',
  category: 'solid',
  fields: [
    lengthField('base', 'Base side', 'Length of one side of the square base.', { aliases: ['width'] }),
    lengthField('height', 'Height', 'Distance from the base straight up to the tip.', {
      aliases: ['height'],
    }),
  ],
  defaults: { base: 2, height: 2 },
  build: (p) => {
    const a = num(p, 'base', 2);
    const g = new ConeGeometry(a / Math.SQRT2, num(p, 'height', 2), 4, 1);
    g.rotateY(PI / 4); // line the base edges up with the X and Z axes
    return g;
  },
  formulas: (p) => {
    const a = num(p, 'base'),
      h = num(p, 'height');
    const l = Math.sqrt((a / 2) ** 2 + h * h);
    return [
      {
        quantity: 'Volume',
        formula: 'V = ⅓ × base² × height',
        working: `V = ⅓ × ${fmt(a)}² × ${fmt(h)}`,
        value: (a * a * h) / 3,
        power: 3,
      },
      {
        quantity: 'Slant height',
        formula: 'l = √((a/2)² + h²)',
        working: `l = √(${fmt(a / 2)}² + ${fmt(h)}²)`,
        value: l,
        power: 1,
      },
      {
        quantity: 'Surface area',
        formula: 'A = a² + 2 × a × l',
        working: `A = ${fmt(a)}² + 2 × ${fmt(a)} × ${fmt(l)}`,
        value: a * a + 2 * a * l,
        power: 2,
      },
    ];
  },
};

export const prism: ShapeDefinition = {
  type: 'prism',
  label: 'Prism',
  description:
    'A shape with the same flat polygon at the top and bottom, like a pencil (6 sides) or a Toblerone (3).',
  icon: '✏️',
  category: 'solid',
  fields: [
    {
      kind: 'number',
      key: 'sides',
      label: 'Number of sides',
      help: 'How many sides the top and bottom polygon has (3 = triangle, 6 = hexagon).',
      unit: 'count',
      min: 3,
      max: 12,
      step: 1,
      integer: true,
    },
    lengthField('side', 'Side length', 'Length of one edge of the polygon.'),
    lengthField('height', 'Height', 'Distance between the top and bottom polygons.', { aliases: ['height'] }),
  ],
  defaults: { sides: 6, side: 1, height: 3 },
  build: (p) => {
    const n = Math.round(num(p, 'sides', 6));
    const R = num(p, 'side', 1) / (2 * Math.sin(PI / n));
    return new CylinderGeometry(R, R, num(p, 'height', 3), n, 1, false, PI / n);
  },
  formulas: (p) => {
    const n = Math.round(num(p, 'sides', 6)),
      a = num(p, 'side'),
      h = num(p, 'height');
    const base = (n * a * a) / (4 * Math.tan(PI / n));
    return [
      {
        quantity: 'Base area',
        formula: 'B = n × a² ÷ (4 × tan(180°/n))',
        working: `B = ${n} × ${fmt(a)}² ÷ (4 × tan(${fmt(180 / n)}°))`,
        value: base,
        power: 2,
      },
      {
        quantity: 'Volume',
        formula: 'V = B × h',
        working: `V = ${fmt(base)} × ${fmt(h)}`,
        value: base * h,
        power: 3,
      },
      {
        quantity: 'Surface area',
        formula: 'A = 2B + n × a × h',
        working: `A = 2 × ${fmt(base)} + ${n} × ${fmt(a)} × ${fmt(h)}`,
        value: 2 * base + n * a * h,
        power: 2,
      },
    ];
  },
};

export const capsule: ShapeDefinition = {
  type: 'capsule',
  label: 'Capsule',
  description: 'A cylinder with a half-sphere on each end, like a pill.',
  icon: '💊',
  category: 'solid',
  fields: [
    lengthField('radius', 'Radius', 'Radius of the round ends and the middle.', { aliases: ['radius'] }),
    lengthField('length', 'Middle length', 'Length of the straight middle part.', {
      min: 0,
      aliases: ['height', 'length'],
    }),
    smoothnessField({ max: 64 }),
  ],
  defaults: { radius: 0.6, length: 1.5, smoothness: 24 },
  build: (p) => {
    const s = Math.round(num(p, 'smoothness', 24));
    return new CapsuleGeometry(
      num(p, 'radius', 0.6),
      num(p, 'length', 1.5),
      Math.max(2, Math.round(s / 3)),
      s,
    );
  },
  formulas: (p) => {
    const r = num(p, 'radius'),
      a = num(p, 'length');
    return [
      {
        quantity: 'Volume',
        formula: 'V = π r² × (4/3 × r + a)',
        working: `V = π × ${fmt(r)}² × (4/3 × ${fmt(r)} + ${fmt(a)})`,
        value: PI * r * r * ((4 / 3) * r + a),
        power: 3,
      },
      {
        quantity: 'Surface area',
        formula: 'A = 2πr × (2r + a)',
        working: `A = 2π × ${fmt(r)} × (2 × ${fmt(r)} + ${fmt(a)})`,
        value: 2 * PI * r * (2 * r + a),
        power: 2,
      },
    ];
  },
};

interface PlatonicInfo {
  edgeFromR: (R: number) => number;
  edgeFormula: string;
  volume: (a: number) => number;
  volumeFormula: string;
  area: (a: number) => number;
  areaFormula: string;
}

function platonicFormulas(info: PlatonicInfo, R: number): FormulaLine[] {
  const a = info.edgeFromR(R);
  return [
    {
      quantity: 'Edge length',
      formula: info.edgeFormula,
      working: `R = ${fmt(R)}`,
      value: a,
      power: 1,
    },
    {
      quantity: 'Volume',
      formula: info.volumeFormula,
      working: `a = ${fmt(a)}`,
      value: info.volume(a),
      power: 3,
    },
    {
      quantity: 'Surface area',
      formula: info.areaFormula,
      working: `a = ${fmt(a)}`,
      value: info.area(a),
      power: 2,
    },
  ];
}

const sizeField = lengthField(
  'radius',
  'Size (center to corner)',
  'Distance from the center to any corner.',
  {
    aliases: ['radius'],
  },
);

const TETRA: PlatonicInfo = {
  edgeFromR: (R) => R * Math.sqrt(8 / 3),
  edgeFormula: 'a = R × √(8/3)',
  volume: (a) => a ** 3 / (6 * Math.SQRT2),
  volumeFormula: 'V = a³ ÷ (6√2)',
  area: (a) => Math.sqrt(3) * a * a,
  areaFormula: 'A = √3 × a²',
};
const OCTA: PlatonicInfo = {
  edgeFromR: (R) => R * Math.SQRT2,
  edgeFormula: 'a = R × √2',
  volume: (a) => (Math.SQRT2 / 3) * a ** 3,
  volumeFormula: 'V = (√2 ÷ 3) × a³',
  area: (a) => 2 * Math.sqrt(3) * a * a,
  areaFormula: 'A = 2√3 × a²',
};
const DODECA: PlatonicInfo = {
  edgeFromR: (R) => (4 * R) / (Math.sqrt(3) * (1 + SQRT5)),
  edgeFormula: 'a = 4R ÷ (√3 × (1 + √5))',
  volume: (a) => ((15 + 7 * SQRT5) / 4) * a ** 3,
  volumeFormula: 'V = (15 + 7√5) ÷ 4 × a³',
  area: (a) => 3 * Math.sqrt(25 + 10 * SQRT5) * a * a,
  areaFormula: 'A = 3 × √(25 + 10√5) × a²',
};
const ICOSA: PlatonicInfo = {
  edgeFromR: (R) => (4 * R) / Math.sqrt(10 + 2 * SQRT5),
  edgeFormula: 'a = 4R ÷ √(10 + 2√5)',
  volume: (a) => ((5 * (3 + SQRT5)) / 12) * a ** 3,
  volumeFormula: 'V = 5(3 + √5) ÷ 12 × a³',
  area: (a) => 5 * Math.sqrt(3) * a * a,
  areaFormula: 'A = 5√3 × a²',
};

export const tetrahedron: ShapeDefinition = {
  type: 'tetrahedron',
  label: 'Tetrahedron',
  description: '4 equal triangle faces. The simplest Platonic solid, like a triangular pyramid.',
  icon: '🔻',
  category: 'solid',
  fields: [sizeField],
  defaults: { radius: 1.2 },
  build: (p) => new TetrahedronGeometry(num(p, 'radius', 1.2)),
  formulas: (p) => platonicFormulas(TETRA, num(p, 'radius')),
};

export const octahedron: ShapeDefinition = {
  type: 'octahedron',
  label: 'Octahedron',
  description: '8 equal triangle faces, like two square pyramids glued base to base.',
  icon: '💠',
  category: 'solid',
  fields: [sizeField],
  defaults: { radius: 1.2 },
  build: (p) => new OctahedronGeometry(num(p, 'radius', 1.2)),
  formulas: (p) => platonicFormulas(OCTA, num(p, 'radius')),
};

export const dodecahedron: ShapeDefinition = {
  type: 'dodecahedron',
  label: 'Dodecahedron',
  description: '12 equal pentagon faces. A Platonic solid often used for dice (d12).',
  icon: '🎲',
  category: 'solid',
  fields: [sizeField],
  defaults: { radius: 1.2 },
  build: (p) => new DodecahedronGeometry(num(p, 'radius', 1.2)),
  formulas: (p) => platonicFormulas(DODECA, num(p, 'radius')),
};

export const icosahedron: ShapeDefinition = {
  type: 'icosahedron',
  label: 'Icosahedron',
  description: '20 equal triangle faces. A Platonic solid used for d20 dice.',
  icon: '🔷',
  category: 'solid',
  fields: [sizeField],
  defaults: { radius: 1.2 },
  build: (p) => new IcosahedronGeometry(num(p, 'radius', 1.2)),
  formulas: (p) => platonicFormulas(ICOSA, num(p, 'radius')),
};

export const torusKnot: ShapeDefinition = {
  type: 'torusKnot',
  label: 'Torus knot',
  description: 'A tube tied in a knot. p = turns around the ring, q = turns through the hole.',
  icon: '🪢',
  category: 'solid',
  fields: [
    lengthField('radius', 'Size', 'Overall radius of the knot.', { aliases: ['radius'] }),
    lengthField('tube', 'Tube thickness', 'Radius of the tube.', { min: 0.05, step: 0.05 }),
    {
      kind: 'number',
      key: 'p',
      label: 'Turns around (p)',
      help: 'How many times the tube winds around the ring.',
      unit: 'count',
      min: 1,
      max: 12,
      step: 1,
      integer: true,
    },
    {
      kind: 'number',
      key: 'q',
      label: 'Turns through (q)',
      help: 'How many times the tube winds through the hole.',
      unit: 'count',
      min: 1,
      max: 12,
      step: 1,
      integer: true,
    },
    smoothnessField({ min: 8, max: 64 }),
  ],
  defaults: { radius: 1.2, tube: 0.3, p: 2, q: 3, smoothness: 24 },
  build: (p) => {
    const s = Math.round(num(p, 'smoothness', 24));
    return new TorusKnotGeometry(
      num(p, 'radius', 1.2),
      num(p, 'tube', 0.3),
      s * 6,
      Math.max(3, Math.round(s / 2)),
      Math.round(num(p, 'p', 2)),
      Math.round(num(p, 'q', 3)),
    );
  },
};
