import type { Vec2 } from './types';

/** Distance from p to the segment a–b. */
function segmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Keep only the points that matter (Ramer–Douglas–Peucker): a wobbly hand line becomes a few clean ones. */
export function simplifyLine(points: Vec2[], tolerance: number): Vec2[] {
  if (points.length < 3) return points;
  let worst = 0;
  let index = 0;
  const last = points.length - 1;
  for (let i = 1; i < last; i++) {
    const d = segmentDistance(points[i], points[0], points[last]);
    if (d > worst) {
      worst = d;
      index = i;
    }
  }
  if (worst <= tolerance) return [points[0], points[last]];
  const left = simplifyLine(points.slice(0, index + 1), tolerance);
  const right = simplifyLine(points.slice(index), tolerance);
  return [...left.slice(0, -1), ...right];
}

/** Area inside a closed outline (shoelace formula). */
export function polygonArea(points: Vec2[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

export interface FloorDrawing {
  /** Points relative to the centre, in the shape's own flat plane (y is "back", i.e. −z on the floor). */
  points: Vec2[];
  centre: { x: number; z: number };
  /** The line ends near where it started. */
  loop: boolean;
}

const round = (v: number) => Number(v.toFixed(2));

/**
 * Turn points drawn on the floor (x, z) into a flat outline centred on its middle.
 * Shapes are built flat (x, y) and then laid down by turning them −90° around X, which sends y to −z.
 */
export function floorDrawing(floor: Vec2[], tolerance: number): FloorDrawing | null {
  const clean = floor.filter(
    (p, i) => i === 0 || Math.hypot(p[0] - floor[i - 1][0], p[1] - floor[i - 1][1]) > 1e-3,
  );
  if (clean.length < 2) return null;
  let pts = simplifyLine(clean, tolerance);
  const first = pts[0];
  const lastPt = pts[pts.length - 1];
  const span = Math.max(...pts.map((p) => Math.hypot(p[0] - first[0], p[1] - first[1])));
  const loop =
    pts.length >= 3 && Math.hypot(lastPt[0] - first[0], lastPt[1] - first[1]) < Math.max(0.6, span * 0.2);
  if (loop && pts.length > 3) pts = pts.slice(0, -1); // the closing point repeats the first one
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  return {
    points: pts.map(([x, z]) => [round(x - cx), round(-(z - cz))]),
    centre: { x: round(cx), z: round(cz) },
    loop,
  };
}
