import { num, str } from '../fields';
import { fmt, GOLDEN_ANGLE_DEG } from '../math';
import type { Params } from '../types';
import { angleOpts, DEG, lengthOpts, numberField, yaw } from './shared';
import type { BasePlacement, PatternDefinition } from './types';

function spiralPoint(p: Params, i: number, n: number) {
  const style = str(p, 'style', 'flat');
  const R = num(p, 'radius', 20);
  const start = num(p, 'startAngle', 0);
  const step = style === 'sunflower' ? GOLDEN_ANGLE_DEG : num(p, 'angleStep', 30);
  const frac = n > 1 ? i / (n - 1) : 0;
  const r = style === 'helix' ? R : style === 'sunflower' ? R * Math.sqrt(frac) : R * frac;
  const thetaDeg = start + i * step;
  const y = i * num(p, 'rise', 0);
  return { r, thetaDeg, y, step, R, frac };
}

export const spiral: PatternDefinition = {
  type: 'spiral',
  label: 'Spiral',
  icon: '🌀',
  description: 'Each object turns a little further around the center and moves a bit outwards (or upwards).',
  fields: [
    {
      kind: 'select',
      key: 'style',
      label: 'Spiral type',
      help: 'Flat spiral grows outwards. Helix stays the same width and climbs (like a spring). Sunflower uses the golden angle.',
      options: [
        { value: 'flat', label: 'Growing spiral' },
        { value: 'helix', label: 'Helix (spring)' },
        { value: 'sunflower', label: 'Sunflower' },
      ],
    },
    numberField('radius', 'Radius', 'How far the spiral reaches from the center.', {
      ...lengthOpts,
      aliases: ['radius', 'size', 'width'],
    }),
    numberField(
      'angleStep',
      'Turn between objects',
      'How many degrees each object turns past the previous one.',
      {
        ...angleOpts,
        min: -180,
        max: 180,
        aliases: ['rotation', 'turn', 'angle'],
        visibleIf: (p) => str(p, 'style') !== 'sunflower',
      },
    ),
    numberField('rise', 'Climb per object', 'How much higher each object is than the previous one.', {
      ...lengthOpts,
      min: -5,
      max: 5,
      step: 0.05,
      aliases: ['height', 'rise', 'climb'],
    }),
    numberField('startAngle', 'Start angle', 'Where around the circle the first object sits.', {
      ...angleOpts,
      aliases: ['start'],
    }),
  ],
  defaults: { style: 'flat', radius: 20, angleStep: 30, rise: 0.15, startAngle: 0 },
  defaultCount: 100,
  generate(p, n) {
    const out: BasePlacement[] = [];
    for (let i = 0; i < n; i++) {
      const { r, thetaDeg, y } = spiralPoint(p, i, n);
      const th = thetaDeg * DEG;
      out.push({ position: [r * Math.cos(th), y, r * Math.sin(th)], align: yaw(-th) });
    }
    return out;
  },
  explain(p, n) {
    const style = str(p, 'style', 'flat');
    const R = num(p, 'radius', 20);
    const rise = num(p, 'rise', 0);
    const radiusRule =
      style === 'helix'
        ? `r = ${fmt(R)} (the same for every object)`
        : style === 'sunflower'
          ? `r = ${fmt(R)} × √(i ÷ ${Math.max(1, n - 1)})`
          : `r = ${fmt(R)} × i ÷ ${Math.max(1, n - 1)}`;
    const angleRule =
      style === 'sunflower'
        ? `θ = ${fmt(num(p, 'startAngle', 0))}° + i × 137.5°  (the golden angle)`
        : `θ = ${fmt(num(p, 'startAngle', 0))}° + i × ${fmt(num(p, 'angleStep', 30))}°`;
    return {
      idea:
        style === 'sunflower'
          ? 'Sunflowers pack their seeds by turning 137.5° (the golden angle) for every new seed. The distance from the center grows like a square root, so the seeds never crowd.'
          : 'Every object is turned a fixed angle further around the center than the one before. Turning many times makes a spiral.',
      formulas: [
        'Objects are numbered i = 0, 1, 2, …',
        `Angle: ${angleRule}`,
        `Distance from center: ${radiusRule}`,
        'x = r × cos(θ)',
        'z = r × sin(θ)',
        `y = i × ${fmt(rise)}  (height)`,
      ],
      worked: (i) => {
        const { r, thetaDeg, y } = spiralPoint(p, i, n);
        const th = thetaDeg * DEG;
        return [
          `θ = ${fmt(thetaDeg)}°`,
          `r = ${fmt(r)}`,
          `x = ${fmt(r)} × cos(${fmt(thetaDeg)}°) = ${fmt(r * Math.cos(th))}`,
          `z = ${fmt(r)} × sin(${fmt(thetaDeg)}°) = ${fmt(r * Math.sin(th))}`,
          `y = ${i} × ${fmt(rise)} = ${fmt(y)}`,
        ];
      },
    };
  },
};
