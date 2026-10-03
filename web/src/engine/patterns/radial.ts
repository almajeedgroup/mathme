import { bool, num } from '../fields';
import { fmt } from '../math';
import type { Params } from '../types';
import { lengthOpts, numberField, yaw } from './shared';
import type { BasePlacement, PatternDefinition } from './types';

interface RingSlot {
  ring: number; // 0 = center object
  slot: number;
  slots: number;
  r: number;
  theta: number;
  y: number;
}

function ringSlots(p: Params, n: number): RingSlot[] {
  const first = Math.max(1, Math.round(num(p, 'firstRing', 6)));
  const gap = num(p, 'ringGap', 3);
  const rise = num(p, 'heightStep', 0);
  const center = bool(p, 'centerObject', true);
  const out: RingSlot[] = [];
  if (center && n > 0) out.push({ ring: 0, slot: 0, slots: 1, r: 0, theta: 0, y: 0 });
  for (let k = 1; out.length < n; k++) {
    const slots = first * k;
    const offset = k % 2 === 0 ? Math.PI / slots : 0; // stagger alternate rings
    for (let j = 0; j < slots && out.length < n; j++) {
      out.push({
        ring: k,
        slot: j,
        slots,
        r: k * gap,
        theta: (2 * Math.PI * j) / slots + offset,
        y: k * rise,
      });
    }
  }
  return out;
}

export const radial: PatternDefinition = {
  type: 'radial',
  label: 'Radial rings',
  icon: '🎯',
  description:
    'Rings inside rings, like a target or a flower. Each ring holds more objects than the one inside it.',
  fields: [
    numberField(
      'firstRing',
      'Objects in first ring',
      'Ring 1 has this many objects, ring 2 has twice as many, and so on.',
      {
        unit: 'count',
        min: 1,
        max: 24,
        step: 1,
        integer: true,
      },
    ),
    numberField('ringGap', 'Gap between rings', 'Distance from one ring to the next.', {
      ...lengthOpts,
      max: 20,
      aliases: ['spacing', 'gap', 'radius'],
    }),
    numberField('heightStep', 'Height per ring', 'Lift each ring higher (or lower) than the one inside it.', {
      ...lengthOpts,
      min: -10,
      max: 10,
      aliases: ['height', 'rise'],
    }),
    {
      kind: 'boolean',
      key: 'centerObject',
      label: 'Object in the middle',
      help: 'Put one object at the very center.',
    },
  ],
  defaults: { firstRing: 6, ringGap: 3, heightStep: 0, centerObject: true },
  defaultCount: 91,
  generate(p, n) {
    return ringSlots(p, n).map<BasePlacement>((s) => ({
      position: [s.r * Math.cos(s.theta), s.y, s.r * Math.sin(s.theta)],
      align: yaw(-s.theta),
    }));
  },
  explain(p, n) {
    const first = Math.max(1, Math.round(num(p, 'firstRing', 6)));
    const gap = num(p, 'ringGap', 3);
    const slots = ringSlots(p, n);
    return {
      idea: `Ring number k sits at distance k × ${fmt(gap)} from the center and holds ${first} × k objects, so the objects stay about the same distance apart as the rings get bigger.`,
      formulas: [
        `Ring k has ${first} × k objects`,
        `Radius of ring k: r = k × ${fmt(gap)}`,
        'Object j in ring k: θ = 360° × j ÷ (objects in ring)',
        'x = r × cos(θ),  z = r × sin(θ)',
      ],
      worked: (i) => {
        const s = slots[Math.min(i, slots.length - 1)];
        if (!s) return [];
        if (s.ring === 0) return ['This is the object in the middle: x = 0, z = 0'];
        const deg = (s.theta * 180) / Math.PI;
        return [
          `Ring k = ${s.ring} (${s.slots} objects), object j = ${s.slot}`,
          `r = ${s.ring} × ${fmt(gap)} = ${fmt(s.r)}`,
          `θ = ${fmt(deg)}°`,
          `x = ${fmt(s.r * Math.cos(s.theta))}, z = ${fmt(s.r * Math.sin(s.theta))}`,
        ];
      },
    };
  },
};
