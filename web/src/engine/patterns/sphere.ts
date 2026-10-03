import { num, str } from '../fields';
import { fmt, GOLDEN_ANGLE_DEG } from '../math';
import type { Params } from '../types';
import { alignUp, DEG, lengthOpts, numberField } from './shared';
import type { BasePlacement, PatternDefinition } from './types';

function fibPoint(p: Params, i: number, n: number) {
  const dome = str(p, 'coverage', 'full') === 'dome';
  const R = num(p, 'radius', 10);
  const h = dome ? 1 - (i + 0.5) / n : 1 - (2 * (i + 0.5)) / n; // height from +1 down to -1 (or 0)
  const ring = Math.sqrt(Math.max(0, 1 - h * h));
  const thetaDeg = i * GOLDEN_ANGLE_DEG;
  const th = thetaDeg * DEG;
  return { R, h, ring, thetaDeg, nx: ring * Math.cos(th), ny: h, nz: ring * Math.sin(th), dome };
}

export const spherePattern: PatternDefinition = {
  type: 'sphere',
  label: 'Sphere',
  icon: '🌐',
  description:
    'Objects spread evenly over the surface of a ball (or a dome), like the dimples on a golf ball.',
  fields: [
    numberField('radius', 'Radius', 'Size of the ball the objects sit on.', {
      ...lengthOpts,
      min: 0.5,
      aliases: ['radius', 'size'],
    }),
    {
      kind: 'select',
      key: 'coverage',
      label: 'Cover',
      help: 'The whole ball, or just the top half (a dome).',
      options: [
        { value: 'full', label: 'Whole sphere' },
        { value: 'dome', label: 'Top half (dome)' },
      ],
    },
  ],
  defaults: { radius: 10, coverage: 'full' },
  defaultCount: 200,
  generate(p, n) {
    const out: BasePlacement[] = [];
    for (let i = 0; i < n; i++) {
      const f = fibPoint(p, i, n);
      out.push({ position: [f.R * f.nx, f.R * f.ny, f.R * f.nz], align: alignUp(f.nx, f.ny, f.nz) });
    }
    return out;
  },
  explain(p, n) {
    const { R, dome } = fibPoint(p, 0, n);
    return {
      idea: 'This is the "Fibonacci sphere". Objects are placed from top to bottom at evenly spaced heights, and each one turns 137.5° (the golden angle) round from the last, so they never line up in stripes.',
      formulas: [
        dome
          ? `h = 1 − (i + 0.5) ÷ ${n}   (height, from 1 down to 0)`
          : `h = 1 − 2 × (i + 0.5) ÷ ${n}   (height, from 1 down to −1)`,
        'ring = √(1 − h²)   (Pythagoras: radius of the circle at that height)',
        'θ = i × 137.5°',
        `x = ${fmt(R)} × ring × cos(θ),  y = ${fmt(R)} × h,  z = ${fmt(R)} × ring × sin(θ)`,
      ],
      worked: (i) => {
        const f = fibPoint(p, i, n);
        return [
          `h = ${fmt(f.h, 3)}`,
          `ring = √(1 − ${fmt(f.h, 3)}²) = ${fmt(f.ring, 3)}`,
          `θ = ${i} × 137.5° = ${fmt(f.thetaDeg)}°`,
          `x = ${fmt(f.R * f.nx)}, y = ${fmt(f.R * f.ny)}, z = ${fmt(f.R * f.nz)}`,
        ];
      },
    };
  },
};
