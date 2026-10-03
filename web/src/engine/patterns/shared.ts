import type { NumberField } from '../fields';

export const DEG = Math.PI / 180;

/** Quaternion for a turn of `angle` radians around the vertical (Y) axis. */
export function yaw(angle: number): [number, number, number, number] {
  return [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)];
}

/** Quaternion that turns the +Y axis to point along (x, y, z) (must be unit length). */
export function alignUp(x: number, y: number, z: number): [number, number, number, number] {
  // rotation from (0,1,0) to v: axis = up × v = (z, 0, -x), angle = acos(y)
  if (y > 0.999999) return [0, 0, 0, 1];
  if (y < -0.999999) return [1, 0, 0, 0];
  const w = 1 + y;
  const len = Math.hypot(z, x, w);
  return [z / len, 0, -x / len, w / len];
}

export function numberField(
  key: string,
  label: string,
  help: string,
  opts: Partial<NumberField> & Pick<NumberField, 'unit' | 'min' | 'max' | 'step'>,
): NumberField {
  return { kind: 'number', key, label, help, ...opts };
}

export const lengthOpts = { unit: 'length', min: 0, max: 60, step: 0.1, hardMax: 2000 } as const;
export const angleOpts = { unit: 'angle', min: -360, max: 360, step: 1, hardMax: 3600 } as const;
