import { num } from '../fields';
import { fmt } from '../math';
import type { Params } from '../types';
import { angleOpts, DEG, lengthOpts, numberField, yaw } from './shared';
import type { BasePlacement, PatternDefinition } from './types';

function circleAngle(p: Params, i: number, n: number): number {
  const arc = num(p, 'arc', 360);
  const start = num(p, 'startAngle', 0);
  const full = Math.abs(arc) >= 360;
  const div = full ? n : Math.max(1, n - 1);
  return start + (arc * i) / div;
}

export const circle: PatternDefinition = {
  type: 'circle',
  label: 'Circle',
  icon: '⭕',
  description: 'Objects spaced evenly around a circle, like the numbers on a clock.',
  fields: [
    numberField('radius', 'Radius', 'Distance from the center of the circle to each object.', {
      ...lengthOpts,
      aliases: ['radius', 'size'],
    }),
    numberField('arc', 'How much of the circle', '360° = a full circle, 180° = half a circle (an arch).', {
      unit: 'angle',
      min: 10,
      max: 360,
      step: 5,
      aliases: ['arc'],
    }),
    numberField('startAngle', 'Start angle', 'Where the first object sits.', {
      ...angleOpts,
      aliases: ['start', 'rotation', 'turn', 'angle'],
    }),
  ],
  defaults: { radius: 10, arc: 360, startAngle: 0 },
  defaultCount: 12,
  generate(p, n) {
    const R = num(p, 'radius', 10);
    const out: BasePlacement[] = [];
    for (let i = 0; i < n; i++) {
      const th = circleAngle(p, i, n) * DEG;
      out.push({ position: [R * Math.cos(th), 0, R * Math.sin(th)], align: yaw(-th) });
    }
    return out;
  },
  explain(p, n) {
    const R = num(p, 'radius', 10);
    const arc = num(p, 'arc', 360);
    const full = Math.abs(arc) >= 360;
    const step = arc / (full ? n : Math.max(1, n - 1));
    return {
      idea: `The ${fmt(arc)}° are shared equally, so each object is ${fmt(step)}° further round than the one before.`,
      formulas: [
        `Angle step = ${fmt(arc)}° ÷ ${full ? n : `(${n} − 1)`} = ${fmt(step)}°`,
        `θ = ${fmt(num(p, 'startAngle', 0))}° + i × ${fmt(step)}°`,
        `x = ${fmt(R)} × cos(θ)`,
        `z = ${fmt(R)} × sin(θ)`,
      ],
      worked: (i) => {
        const deg = circleAngle(p, i, n);
        const th = deg * DEG;
        return [
          `θ = ${fmt(deg)}°`,
          `x = ${fmt(R)} × cos(${fmt(deg)}°) = ${fmt(R * Math.cos(th))}`,
          `z = ${fmt(R)} × sin(${fmt(deg)}°) = ${fmt(R * Math.sin(th))}`,
        ];
      },
    };
  },
};
