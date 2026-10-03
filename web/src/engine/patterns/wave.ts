import { num, str } from '../fields';
import { fmt } from '../math';
import type { Params } from '../types';
import { DEG, lengthOpts, numberField } from './shared';
import type { BasePlacement, PatternDefinition } from './types';

function wavePoint(p: Params, i: number, n: number) {
  const cols = Math.max(1, Math.round(num(p, 'columns', 20)));
  const gap = num(p, 'spacing', 1.5);
  const rows = Math.ceil(n / cols);
  const col = i % cols;
  const row = Math.floor(i / cols);
  const x = (col - (Math.min(cols, n) - 1) / 2) * gap;
  const z = (row - (rows - 1) / 2) * gap;
  const A = num(p, 'amplitude', 2);
  const L = Math.max(0.01, num(p, 'wavelength', 10));
  const phase = num(p, 'phase', 0) * DEG;
  const k = (2 * Math.PI) / L;
  const style = str(p, 'style', 'lines');
  const d = Math.hypot(x, z);
  const y =
    style === 'ripple'
      ? A * Math.sin(k * d + phase)
      : style === 'eggcrate'
        ? A * Math.sin(k * x + phase) * Math.cos(k * z)
        : A * Math.sin(k * x + phase);
  return { x, y, z, d, A, L, style };
}

export const wave: PatternDefinition = {
  type: 'wave',
  label: 'Wave',
  icon: '🌊',
  description: 'A flat grid where the height of each object follows a sine wave, like ripples on water.',
  fields: [
    {
      kind: 'select',
      key: 'style',
      label: 'Wave type',
      help: 'Straight waves, circular ripples from the middle, or an egg-crate of bumps.',
      options: [
        { value: 'lines', label: 'Straight waves' },
        { value: 'ripple', label: 'Ripples' },
        { value: 'eggcrate', label: 'Egg crate' },
      ],
    },
    numberField('columns', 'Columns', 'How many objects in each row.', {
      unit: 'count',
      min: 1,
      max: 80,
      step: 1,
      hardMax: 500,
      integer: true,
      aliases: ['columns', 'cols'],
    }),
    numberField('spacing', 'Spacing', 'Distance between neighbouring objects.', {
      ...lengthOpts,
      max: 10,
      aliases: ['spacing', 'gap'],
    }),
    numberField('amplitude', 'Wave height', 'How high the wave goes above (and below) the middle.', {
      ...lengthOpts,
      max: 20,
      aliases: ['amplitude', 'height'],
    }),
    numberField('wavelength', 'Wave length', 'Distance from one wave top to the next.', {
      ...lengthOpts,
      min: 0.5,
      max: 60,
      aliases: ['wavelength', 'length'],
    }),
    numberField('phase', 'Shift', 'Slide the wave sideways (360° = one whole wave).', {
      unit: 'angle',
      min: 0,
      max: 360,
      step: 5,
      aliases: ['phase', 'shift'],
    }),
  ],
  defaults: { style: 'ripple', columns: 20, spacing: 1.5, amplitude: 2, wavelength: 10, phase: 0 },
  defaultCount: 400,
  generate(p, n) {
    const out: BasePlacement[] = [];
    for (let i = 0; i < n; i++) {
      const { x, y, z } = wavePoint(p, i, n);
      out.push({ position: [x, y, z] });
    }
    return out;
  },
  explain(p, n) {
    const { A, L, style } = wavePoint(p, 0, n);
    const k = `360° ÷ ${fmt(L)}`;
    const shift = num(p, 'phase', 0);
    const ph = shift ? ` + ${fmt(shift)}°` : '';
    const formula =
      style === 'ripple'
        ? `y = ${fmt(A)} × sin(${k} × d${ph}),  where d = √(x² + z²) is the distance from the middle`
        : style === 'eggcrate'
          ? `y = ${fmt(A)} × sin(${k} × x${ph}) × cos(${k} × z)`
          : `y = ${fmt(A)} × sin(${k} × x${ph})`;
    return {
      idea: 'The objects sit on a grid. The sine function turns each position into a height between −A and +A, making waves.',
      formulas: [
        'x and z come from a grid (like the Grid pattern)',
        formula,
        `A = ${fmt(A)} is the wave height, ${fmt(L)} is the wave length`,
      ],
      worked: (i) => {
        const pt = wavePoint(p, i, n);
        return [
          `x = ${fmt(pt.x)}, z = ${fmt(pt.z)}${pt.style === 'ripple' ? `, d = ${fmt(pt.d)}` : ''}`,
          `y = ${fmt(pt.y)}`,
        ];
      },
    };
  },
};
