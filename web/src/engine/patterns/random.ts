import { num, str } from '../fields';
import { fmt } from '../math';
import { between } from '../rng';
import { lengthOpts, numberField } from './shared';
import type { BasePlacement, PatternDefinition } from './types';

export const random: PatternDefinition = {
  type: 'random',
  label: 'Random scatter',
  icon: '🎲',
  description: 'Objects dropped at random spots inside a box or a ball. Change the seed to shuffle them.',
  fields: [
    {
      kind: 'select',
      key: 'area',
      label: 'Scatter inside',
      help: 'The space the random objects are placed in.',
      options: [
        { value: 'box', label: 'A box' },
        { value: 'ball', label: 'A ball' },
      ],
    },
    numberField('width', 'Width', 'Size of the box from left to right.', {
      ...lengthOpts,
      aliases: ['width', 'size'],
      visibleIf: (p) => str(p, 'area', 'box') === 'box',
    }),
    numberField('height', 'Height', 'Size of the box from bottom to top.', {
      ...lengthOpts,
      aliases: ['height'],
      visibleIf: (p) => str(p, 'area', 'box') === 'box',
    }),
    numberField('depth', 'Depth', 'Size of the box from front to back.', {
      ...lengthOpts,
      aliases: ['depth'],
      visibleIf: (p) => str(p, 'area', 'box') === 'box',
    }),
    numberField('radius', 'Radius', 'Size of the ball.', {
      ...lengthOpts,
      aliases: ['radius'],
      visibleIf: (p) => str(p, 'area', 'box') === 'ball',
    }),
  ],
  defaults: { area: 'box', width: 30, height: 10, depth: 30, radius: 12 },
  defaultCount: 150,
  generate(p, n, rng) {
    const out: BasePlacement[] = [];
    const ball = str(p, 'area', 'box') === 'ball';
    const w = num(p, 'width', 30),
      h = num(p, 'height', 10),
      d = num(p, 'depth', 30),
      R = num(p, 'radius', 12);
    for (let i = 0; i < n; i++) {
      if (ball) {
        // random direction (uniform on the sphere) and a cube-root radius so the ball fills evenly
        const y = between(rng, -1, 1);
        const th = between(rng, 0, Math.PI * 2);
        const ring = Math.sqrt(1 - y * y);
        const r = R * Math.cbrt(rng());
        out.push({ position: [r * ring * Math.cos(th), r * y, r * ring * Math.sin(th)] });
      } else {
        out.push({
          position: [between(rng, -w / 2, w / 2), between(rng, -h / 2, h / 2), between(rng, -d / 2, d / 2)],
        });
        rng(); // keep the same number of random draws as the ball mode
      }
    }
    return out;
  },
  explain(p) {
    const ball = str(p, 'area', 'box') === 'ball';
    const w = num(p, 'width', 30),
      h = num(p, 'height', 10),
      d = num(p, 'depth', 30),
      R = num(p, 'radius', 12);
    return {
      idea: 'A computer cannot really roll dice, so it uses a formula that makes numbers which look random. The "seed" is the starting number: the same seed always gives the same scatter.',
      formulas: ball
        ? [
            'Pick a random direction, then a random distance r from the center',
            `r = ${fmt(R)} × ∛(random number between 0 and 1)`,
            'The cube root keeps the objects evenly spread (a ball has more room near its outside).',
          ]
        : [
            `x = random number between ${fmt(-w / 2)} and ${fmt(w / 2)}`,
            `y = random number between ${fmt(-h / 2)} and ${fmt(h / 2)}`,
            `z = random number between ${fmt(-d / 2)} and ${fmt(d / 2)}`,
          ],
      worked: () => [],
    };
  },
};
