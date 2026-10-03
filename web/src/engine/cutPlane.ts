import type { Vec3 } from './types';

/**
 * A cutting plane described in a student-friendly way: how far it is tipped from lying flat
 * (tilt), which way it faces around the vertical axis (turn), and how far it is slid along its
 * own direction from the centre of the model (shift).
 */
export interface CutAngles {
  tilt: number; // degrees, 0 = normal points straight up (a horizontal cut)
  turn: number; // degrees around the vertical axis, 0 = facing the front (+z)
  shift: number; // distance from the centre, along the normal
}

const D = Math.PI / 180;

export function normalFromAngles(tilt: number, turn: number): Vec3 {
  const t = tilt * D;
  const u = turn * D;
  return [Math.sin(t) * Math.sin(u), Math.cos(t), Math.sin(t) * Math.cos(u)];
}

export function anglesFromCut(point: Vec3, normal: Vec3, centre: Vec3): CutAngles {
  const len = Math.hypot(...normal) || 1;
  const n = normal.map((v) => v / len) as Vec3;
  const tilt = Math.acos(Math.max(-1, Math.min(1, n[1]))) / D;
  const turn = Math.abs(Math.sin(tilt * D)) < 1e-9 ? 0 : Math.atan2(n[0], n[2]) / D;
  const shift = n[0] * (point[0] - centre[0]) + n[1] * (point[1] - centre[1]) + n[2] * (point[2] - centre[2]);
  return { tilt, turn, shift };
}

export interface PlaneEquation {
  normal: Vec3;
  point: Vec3;
  /** n · x = d */
  d: number;
}

export function planeFromAngles(a: CutAngles, centre: Vec3): PlaneEquation {
  const n = normalFromAngles(a.tilt, a.turn);
  const point: Vec3 = [centre[0] + a.shift * n[0], centre[1] + a.shift * n[1], centre[2] + a.shift * n[2]];
  return { normal: n, point, d: n[0] * point[0] + n[1] * point[1] + n[2] * point[2] };
}

/** Angle (degrees) between the plane's normal and each axis. */
export function anglesToAxes(n: Vec3): { x: number; y: number; z: number } {
  const a = (v: number) => Math.acos(Math.min(1, Math.abs(v))) / D;
  return { x: a(n[0]), y: a(n[1]), z: a(n[2]) };
}
