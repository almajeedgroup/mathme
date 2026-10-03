import { Color, Euler, Matrix4, Quaternion, Vector3 } from 'three';

import { lerp } from './math';
import { getPattern } from './patterns/registry';
import type { BasePlacement } from './patterns/types';
import { createRng } from './rng';
import type { PatternNode, VariationDef } from './types';

export const WARN_OBJECTS = 5000;
export const MAX_OBJECTS = 20000;

export interface PatternLayout {
  count: number;
  /** 16 numbers per object (column-major 4×4 matrices, like three.js). */
  matrices: Float32Array;
  /** 3 numbers per object (linear RGB), or null to use the material colour. */
  colors: Float32Array | null;
  /** The size multiplier given to each object. */
  sizes: Float32Array;
  placements: BasePlacement[];
}

/** Size multiplier for object number i (t goes from 0 for the first object to 1 for the last). */
export function sizeAt(v: VariationDef, t: number, random: number): number {
  switch (v.sizeMode) {
    case 'random':
      return lerp(v.sizeFrom, v.sizeTo, random);
    case 'pulse':
      return lerp(v.sizeFrom, v.sizeTo, (1 - Math.cos(2 * Math.PI * t)) / 2);
    default:
      return lerp(v.sizeFrom, v.sizeTo, t);
  }
}

const DEG = Math.PI / 180;

/** Random number draws used for each object, so changing one setting never reshuffles another. */
const DRAWS_PER_OBJECT = 8;

export function layoutPattern(node: PatternNode): PatternLayout {
  const def = getPattern(node.pattern.type);
  const params = { ...def.defaults, ...node.pattern.params };
  const count = Math.max(0, Math.min(MAX_OBJECTS, Math.round(node.count)));
  const placements = def.generate(params, count, createRng(node.seed));
  const v = node.variation;
  const rng = createRng((node.seed ^ 0x9e3779b9) >>> 0);

  const matrices = new Float32Array(count * 16);
  const sizes = new Float32Array(count);
  const colors = v.colorMode === 'single' ? null : new Float32Array(count * 3);

  const m = new Matrix4();
  const pos = new Vector3();
  const scale = new Vector3();
  const q = new Quaternion();
  const tmp = new Quaternion();
  const euler = new Euler();
  const color = new Color();
  const from = new Color(v.colorFrom);
  const to = new Color(v.colorTo);
  const objectRot = new Quaternion().setFromEuler(
    new Euler(v.objectRotation[0] * DEG, v.objectRotation[1] * DEG, v.objectRotation[2] * DEG, 'XYZ'),
  );
  const yAxis = new Vector3(0, 1, 0);

  for (let i = 0; i < count; i++) {
    const r = Array.from({ length: DRAWS_PER_OBJECT }, rng);
    const t = count > 1 ? i / (count - 1) : 0;
    const p = placements[i];

    // rotation = line up with pattern × spin × fixed object rotation × random wobble
    if (v.followPattern && p.align) q.set(...p.align);
    else q.identity();
    if (v.spinStep) q.multiply(tmp.setFromAxisAngle(yAxis, v.spinStep * i * DEG));
    q.multiply(objectRot);
    if (v.wobble > 0) {
      const w = v.wobble * DEG;
      euler.set((r[1] * 2 - 1) * w, (r[2] * 2 - 1) * w, (r[3] * 2 - 1) * w, 'XYZ');
      q.multiply(tmp.setFromEuler(euler));
    }

    const s = Math.max(0, sizeAt(v, t, r[0]));
    sizes[i] = s;
    scale.set(s, s, s);
    pos.set(...p.position);
    if (v.jitter > 0) {
      pos.x += (r[4] * 2 - 1) * v.jitter;
      pos.y += (r[5] * 2 - 1) * v.jitter;
      pos.z += (r[6] * 2 - 1) * v.jitter;
    }
    m.compose(pos, q, scale);
    m.toArray(matrices, i * 16);

    if (colors) {
      if (v.colorMode === 'gradient') color.lerpColors(from, to, t);
      else if (v.colorMode === 'rainbow') color.setHSL(t * 0.85, 0.75, 0.55);
      else color.setHSL(r[7], 0.7, 0.55);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
  }
  return { count, matrices, colors, sizes, placements };
}
