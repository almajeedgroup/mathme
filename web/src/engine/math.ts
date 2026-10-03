export const DEG = Math.PI / 180;
export const GOLDEN_ANGLE_DEG = 180 * (3 - Math.sqrt(5)); // ≈ 137.508°

export const degToRad = (d: number) => d * DEG;
export const radToDeg = (r: number) => r / DEG;
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Format a number for students: at most `digits` decimals, no trailing zeros. */
export function fmt(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '—';
  const rounded = Number(n.toFixed(digits));
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

/** Format a number with thousands separators for big counts. */
export function fmtCount(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export function uid(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}`;
}
