import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three';

import { num } from '../fields';
import { fmt } from '../math';
import { lengthField, smoothnessField } from './fieldKit';
import type { ShapeDefinition } from './types';

const PI = Math.PI;

export const box: ShapeDefinition = {
  type: 'box',
  label: 'Cuboid',
  description: 'A box. Make all three sides equal to get a cube.',
  icon: '🧊',
  category: 'basic',
  fields: [
    lengthField('width', 'Width', 'How wide it is, from left to right.', { aliases: ['width'] }),
    lengthField('height', 'Height', 'How tall it is, from bottom to top.', { aliases: ['height'] }),
    lengthField('depth', 'Depth (breadth)', 'How deep it is, from front to back.', {
      aliases: ['depth', 'breadth'],
    }),
  ],
  defaults: { width: 2, height: 2, depth: 2 },
  build: (p) => new BoxGeometry(num(p, 'width', 2), num(p, 'height', 2), num(p, 'depth', 2)),
  formulas: (p) => {
    const w = num(p, 'width'),
      h = num(p, 'height'),
      d = num(p, 'depth');
    return [
      {
        quantity: 'Volume',
        formula: 'V = width × height × depth',
        working: `V = ${fmt(w)} × ${fmt(h)} × ${fmt(d)}`,
        value: w * h * d,
        power: 3,
      },
      {
        quantity: 'Surface area',
        formula: 'A = 2 × (w×h + w×d + h×d)',
        working: `A = 2 × (${fmt(w * h)} + ${fmt(w * d)} + ${fmt(h * d)})`,
        value: 2 * (w * h + w * d + h * d),
        power: 2,
      },
    ];
  },
};

export const sphere: ShapeDefinition = {
  type: 'sphere',
  label: 'Sphere',
  description: 'A perfectly round ball. Every point on it is the same distance (the radius) from the center.',
  icon: '⚪',
  category: 'basic',
  fields: [
    lengthField('radius', 'Radius', 'Distance from the center to the surface (half the width).', {
      aliases: ['radius'],
    }),
    smoothnessField(),
  ],
  defaults: { radius: 1, smoothness: 32 },
  build: (p) => {
    const s = Math.round(num(p, 'smoothness', 32));
    return new SphereGeometry(num(p, 'radius', 1), s, Math.max(2, Math.round(s / 2)));
  },
  formulas: (p) => {
    const r = num(p, 'radius');
    return [
      {
        quantity: 'Volume',
        formula: 'V = 4/3 × π × r³',
        working: `V = 4/3 × π × ${fmt(r)}³`,
        value: (4 / 3) * PI * r ** 3,
        power: 3,
      },
      {
        quantity: 'Surface area',
        formula: 'A = 4 × π × r²',
        working: `A = 4 × π × ${fmt(r)}²`,
        value: 4 * PI * r ** 2,
        power: 2,
      },
    ];
  },
};

export const cylinder: ShapeDefinition = {
  type: 'cylinder',
  label: 'Cylinder',
  description: 'Like a can. Make the top smaller than the bottom to get a cut-off cone (frustum).',
  icon: '🥫',
  category: 'basic',
  fields: [
    lengthField('radiusTop', 'Top radius', 'Radius of the top circle.', { min: 0, aliases: ['radius'] }),
    lengthField('radiusBottom', 'Bottom radius', 'Radius of the bottom circle.', {
      min: 0,
      aliases: ['radius'],
    }),
    lengthField('height', 'Height', 'Distance from the bottom circle to the top circle.', {
      aliases: ['height'],
    }),
    smoothnessField(),
  ],
  defaults: { radiusTop: 1, radiusBottom: 1, height: 2, smoothness: 32 },
  build: (p) =>
    new CylinderGeometry(
      num(p, 'radiusTop', 1),
      num(p, 'radiusBottom', 1),
      num(p, 'height', 2),
      Math.round(num(p, 'smoothness', 32)),
    ),
  formulas: (p) => {
    const R = num(p, 'radiusBottom'),
      r = num(p, 'radiusTop'),
      h = num(p, 'height');
    if (Math.abs(R - r) < 1e-9) {
      return [
        {
          quantity: 'Volume',
          formula: 'V = π × r² × h',
          working: `V = π × ${fmt(r)}² × ${fmt(h)}`,
          value: PI * r * r * h,
          power: 3,
        },
        {
          quantity: 'Surface area',
          formula: 'A = 2πr² + 2πrh',
          working: `A = 2π × ${fmt(r)}² + 2π × ${fmt(r)} × ${fmt(h)}`,
          value: 2 * PI * r * r + 2 * PI * r * h,
          power: 2,
        },
      ];
    }
    const s = Math.sqrt((R - r) ** 2 + h * h);
    return [
      {
        quantity: 'Volume',
        formula: 'V = ⅓ × π × h × (R² + R×r + r²)',
        working: `V = ⅓ × π × ${fmt(h)} × (${fmt(R)}² + ${fmt(R)}×${fmt(r)} + ${fmt(r)}²)`,
        value: (PI * h * (R * R + R * r + r * r)) / 3,
        power: 3,
      },
      {
        quantity: 'Slant height',
        formula: 's = √((R − r)² + h²)',
        working: `s = √((${fmt(R)} − ${fmt(r)})² + ${fmt(h)}²)`,
        value: s,
        power: 1,
      },
      {
        quantity: 'Surface area',
        formula: 'A = π(R + r)s + πR² + πr²',
        working: `A = π(${fmt(R)} + ${fmt(r)}) × ${fmt(s)} + π×${fmt(R)}² + π×${fmt(r)}²`,
        value: PI * (R + r) * s + PI * R * R + PI * r * r,
        power: 2,
      },
    ];
  },
};

export const cone: ShapeDefinition = {
  type: 'cone',
  label: 'Cone',
  description: 'A circle at the bottom that narrows to a point at the top, like an ice-cream cone.',
  icon: '🍦',
  category: 'basic',
  fields: [
    lengthField('radius', 'Base radius', 'Radius of the circle at the bottom.', { aliases: ['radius'] }),
    lengthField('height', 'Height', 'Distance from the base up to the tip.', { aliases: ['height'] }),
    smoothnessField(),
  ],
  defaults: { radius: 1, height: 2, smoothness: 32 },
  build: (p) =>
    new ConeGeometry(num(p, 'radius', 1), num(p, 'height', 2), Math.round(num(p, 'smoothness', 32))),
  formulas: (p) => {
    const r = num(p, 'radius'),
      h = num(p, 'height');
    const s = Math.sqrt(r * r + h * h);
    return [
      {
        quantity: 'Volume',
        formula: 'V = ⅓ × π × r² × h',
        working: `V = ⅓ × π × ${fmt(r)}² × ${fmt(h)}`,
        value: (PI * r * r * h) / 3,
        power: 3,
      },
      {
        quantity: 'Slant height',
        formula: 'l = √(r² + h²)',
        working: `l = √(${fmt(r)}² + ${fmt(h)}²)`,
        value: s,
        power: 1,
      },
      {
        quantity: 'Surface area',
        formula: 'A = πr² + πrl',
        working: `A = π×${fmt(r)}² + π×${fmt(r)}×${fmt(s)}`,
        value: PI * r * r + PI * r * s,
        power: 2,
      },
    ];
  },
};

export const torus: ShapeDefinition = {
  type: 'torus',
  label: 'Torus (ring)',
  description: 'A ring or donut shape: a circle-shaped tube bent around into a loop.',
  icon: '🍩',
  category: 'basic',
  fields: [
    lengthField(
      'ringRadius',
      'Ring size',
      'Distance from the center of the hole to the middle of the tube.',
      {
        aliases: ['radius'],
      },
    ),
    lengthField('tube', 'Tube thickness', 'Radius of the tube itself.', { min: 0.05, step: 0.05 }),
    smoothnessField(),
  ],
  defaults: { ringRadius: 1, tube: 0.35, smoothness: 32 },
  build: (p) => {
    const s = Math.round(num(p, 'smoothness', 32));
    const g = new TorusGeometry(
      num(p, 'ringRadius', 1),
      num(p, 'tube', 0.35),
      Math.max(3, Math.round(s / 2)),
      s * 2,
    );
    g.rotateX(Math.PI / 2); // lie flat like a donut on a plate
    return g;
  },
  formulas: (p) => {
    const R = num(p, 'ringRadius'),
      r = num(p, 'tube');
    return [
      {
        quantity: 'Volume',
        formula: 'V = 2 × π² × R × r²',
        working: `V = 2 × π² × ${fmt(R)} × ${fmt(r)}²`,
        value: 2 * PI * PI * R * r * r,
        power: 3,
      },
      {
        quantity: 'Surface area',
        formula: 'A = 4 × π² × R × r',
        working: `A = 4 × π² × ${fmt(R)} × ${fmt(r)}`,
        value: 4 * PI * PI * R * r,
        power: 2,
      },
    ];
  },
};

export const plane: ShapeDefinition = {
  type: 'plane',
  label: 'Flat sheet',
  description: 'A thin flat rectangle, like a sheet of paper. Great as a floor or a tile.',
  icon: '📄',
  category: 'basic',
  open: true,
  fields: [
    lengthField('width', 'Width', 'Size from left to right.', { max: 100, aliases: ['width'] }),
    lengthField('length', 'Length', 'Size from front to back.', { max: 100, aliases: ['length', 'depth'] }),
  ],
  defaults: { width: 4, length: 4 },
  build: (p) => {
    const g = new PlaneGeometry(num(p, 'width', 4), num(p, 'length', 4));
    g.rotateX(-Math.PI / 2); // lie flat, facing up
    return g;
  },
  formulas: (p) => {
    const w = num(p, 'width'),
      l = num(p, 'length');
    return [
      {
        quantity: 'Area',
        formula: 'A = width × length',
        working: `A = ${fmt(w)} × ${fmt(l)}`,
        value: w * l,
        power: 2,
      },
    ];
  },
};
