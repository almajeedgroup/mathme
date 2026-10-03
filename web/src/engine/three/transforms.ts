import { Euler, Matrix4, Quaternion, Vector3 } from 'three';

import { DEG } from '../math';
import type { SymmetryDef, Transform } from '../types';

const _q = new Quaternion();
const _e = new Euler();
const _p = new Vector3();
const _s = new Vector3();

export function transformToMatrix(t: Transform, target = new Matrix4()): Matrix4 {
  _e.set(t.rotation[0] * DEG, t.rotation[1] * DEG, t.rotation[2] * DEG, 'XYZ');
  _q.setFromEuler(_e);
  _p.set(...t.position);
  _s.set(...t.scale);
  return target.compose(_p, _q, _s);
}

/** How many copies a symmetry setting makes (including the original). */
export function symmetryCopyCount(sym: SymmetryDef): number {
  const mirrors = Number(sym.mirrorX) + Number(sym.mirrorY) + Number(sym.mirrorZ);
  return 2 ** mirrors * Math.max(1, Math.round(sym.radialCopies));
}

/**
 * The matrices for every symmetry copy. The first one is always the original (identity).
 * Mirrors flip across the X/Y/Z planes through the origin; radial copies spin around Y.
 */
export function symmetryMatrices(sym: SymmetryDef): Matrix4[] {
  let mirrors: Matrix4[] = [new Matrix4()];
  const flips: [boolean, Vector3][] = [
    [sym.mirrorX, new Vector3(-1, 1, 1)],
    [sym.mirrorY, new Vector3(1, -1, 1)],
    [sym.mirrorZ, new Vector3(1, 1, -1)],
  ];
  for (const [on, scale] of flips) {
    if (!on) continue;
    mirrors = mirrors.flatMap((m) => [m, new Matrix4().makeScale(scale.x, scale.y, scale.z).multiply(m)]);
  }
  const n = Math.max(1, Math.round(sym.radialCopies));
  const out: Matrix4[] = [];
  for (let k = 0; k < n; k++) {
    const rot = new Matrix4().makeRotationY((2 * Math.PI * k) / n);
    for (const m of mirrors) out.push(rot.clone().multiply(m));
  }
  return out;
}
