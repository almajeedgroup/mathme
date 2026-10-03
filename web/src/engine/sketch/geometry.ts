import type { Sketch, SketchCircle, SketchLine, SketchPoint, Vec2 } from '../types';

/** A new, empty sketch. */
export function emptySketch(): Sketch {
  return { points: [], lines: [], circles: [], constraints: [] };
}

export function pointMap(sketch: Sketch): Map<string, SketchPoint> {
  return new Map(sketch.points.map((p) => [p.id, p]));
}

export function lineEnds(sketch: Sketch, line: SketchLine): [SketchPoint, SketchPoint] | null {
  const a = sketch.points.find((p) => p.id === line.a);
  const b = sketch.points.find((p) => p.id === line.b);
  return a && b ? [a, b] : null;
}

export function lineLength(a: SketchPoint, b: SketchPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Angle of the line from a to b, measured anticlockwise from the positive x direction (0–360°). */
export function lineAngle(a: SketchPoint, b: SketchPoint): number {
  const deg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/**
 * The angle between two lines. When they share a corner it is the angle at that corner (0–180°);
 * otherwise the smaller angle between their directions (0–90°).
 */
export function angleBetween(
  sketch: Sketch,
  l1: SketchLine,
  l2: SketchLine,
): { degrees: number; corner: string | null } {
  const e1 = lineEnds(sketch, l1);
  const e2 = lineEnds(sketch, l2);
  if (!e1 || !e2) return { degrees: NaN, corner: null };
  const shared = [l1.a, l1.b].find((id) => id === l2.a || id === l2.b) ?? null;
  const ray = (line: SketchLine, ends: [SketchPoint, SketchPoint], from: string): Vec2 => {
    const [a, b] = ends;
    return from === line.a ? [b.x - a.x, b.y - a.y] : [a.x - b.x, a.y - b.y];
  };
  const u: Vec2 = shared ? ray(l1, e1, shared) : [e1[1].x - e1[0].x, e1[1].y - e1[0].y];
  const v: Vec2 = shared ? ray(l2, e2, shared) : [e2[1].x - e2[0].x, e2[1].y - e2[0].y];
  const lu = Math.hypot(...u);
  const lv = Math.hypot(...v);
  if (lu < 1e-12 || lv < 1e-12) return { degrees: NaN, corner: shared };
  let cos = (u[0] * v[0] + u[1] * v[1]) / (lu * lv);
  cos = Math.max(-1, Math.min(1, cos));
  let degrees = (Math.acos(cos) * 180) / Math.PI;
  if (!shared && degrees > 90) degrees = 180 - degrees;
  return { degrees, corner: shared };
}

// ---------------------------------------------------------------- snapping

export type SnapKind = 'point' | 'midpoint' | 'circle' | 'align' | 'grid' | 'none';

export interface SnapResult {
  x: number;
  y: number;
  kind: SnapKind;
  /** The point snapped onto (kind "point"). */
  pointId?: string;
  /** For "align": the point it lines up with, to draw a guide. */
  guide?: { x: number; y: number };
}

export interface SnapOptions {
  /** How close counts as "on it", in sketch units. */
  tolerance: number;
  /** Grid step, or null for no grid snapping. */
  grid: number | null;
  /** Points to ignore (e.g. the one being dragged). */
  exclude?: Set<string>;
}

/**
 * Where a click or drag should land. In order of preference: an existing point, a line's midpoint, the edge
 * of a circle, lining up with another point (horizontally or vertically), the grid.
 */
export function snap(sketch: Sketch, x: number, y: number, opts: SnapOptions): SnapResult {
  const { tolerance: tol, grid, exclude } = opts;
  const pts = sketch.points.filter((p) => !exclude?.has(p.id));
  let best: SnapResult | null = null;
  let bestD = tol;
  for (const p of pts) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d <= bestD) {
      bestD = d;
      best = { x: p.x, y: p.y, kind: 'point', pointId: p.id };
    }
  }
  if (best) return best;

  const byId = pointMap(sketch);
  for (const l of sketch.lines) {
    if (exclude?.has(l.a) || exclude?.has(l.b)) continue;
    const a = byId.get(l.a);
    const b = byId.get(l.b);
    if (!a || !b) continue;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const d = Math.hypot(mx - x, my - y);
    if (d <= bestD) {
      bestD = d;
      best = { x: mx, y: my, kind: 'midpoint' };
    }
  }
  if (best) return best;

  for (const c of sketch.circles) {
    const centre = byId.get(c.c);
    if (!centre || exclude?.has(c.c)) continue;
    const dx = x - centre.x;
    const dy = y - centre.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1e-9 && Math.abs(dist - c.r) <= tol) {
      return { x: centre.x + (dx / dist) * c.r, y: centre.y + (dy / dist) * c.r, kind: 'circle' };
    }
  }

  const g = (v: number) => (grid ? Math.round(v / grid) * grid : v);
  let sx = g(x);
  let sy = g(y);
  let guide: SnapResult['guide'];
  for (const p of pts) {
    if (Math.abs(p.x - x) <= tol / 2) {
      sx = p.x;
      guide = { x: p.x, y: p.y };
    }
    if (Math.abs(p.y - y) <= tol / 2) {
      sy = p.y;
      guide = { x: p.x, y: p.y };
    }
  }
  if (guide) return { x: sx, y: sy, kind: 'align', guide };
  return grid ? { x: sx, y: sy, kind: 'grid' } : { x, y, kind: 'none' };
}

// ---------------------------------------------------------------- picking

function segmentDistance(px: number, py: number, a: SketchPoint, b: SketchPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2)) : 0;
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

/** The point, line or circle under (x, y), points first. */
export function pick(sketch: Sketch, x: number, y: number, tol: number): string | null {
  for (const p of sketch.points) if (Math.hypot(p.x - x, p.y - y) <= tol) return p.id;
  const byId = pointMap(sketch);
  let best: string | null = null;
  let bestD = tol;
  for (const l of sketch.lines) {
    const a = byId.get(l.a);
    const b = byId.get(l.b);
    if (!a || !b) continue;
    const d = segmentDistance(x, y, a, b);
    if (d <= bestD) {
      bestD = d;
      best = l.id;
    }
  }
  for (const c of sketch.circles) {
    const centre = byId.get(c.c);
    if (!centre) continue;
    const d = Math.abs(Math.hypot(x - centre.x, y - centre.y) - c.r);
    if (d <= bestD) {
      bestD = d;
      best = c.id;
    }
  }
  return best;
}

// ---------------------------------------------------------------- closed shapes

/** A closed shape made of lines: its corner point ids in order around the edge, and the line ids. */
export interface Loop {
  id: string;
  points: string[];
  lines: string[];
}

/**
 * The smallest closed shapes in the drawing. For every line, the shortest way back round from one end to
 * the other (without that line) closes a loop. A triangle drawn as three lines is one loop; two triangles
 * sharing an edge are two loops.
 */
export function findLoops(sketch: Sketch): Loop[] {
  const adj = new Map<string, { to: string; line: string }[]>();
  for (const l of sketch.lines) {
    if (l.a === l.b) continue;
    adj.set(l.a, [...(adj.get(l.a) ?? []), { to: l.b, line: l.id }]);
    adj.set(l.b, [...(adj.get(l.b) ?? []), { to: l.a, line: l.id }]);
  }
  const loops = new Map<string, Loop>();
  for (const l of sketch.lines) {
    if (l.a === l.b) continue;
    // breadth-first search from b back to a, not using this line
    const prev = new Map<string, { from: string; line: string }>();
    const queue = [l.b];
    const seen = new Set([l.b]);
    while (queue.length && !seen.has(l.a)) {
      const at = queue.shift()!;
      for (const e of adj.get(at) ?? []) {
        if (e.line === l.id || seen.has(e.to)) continue;
        seen.add(e.to);
        prev.set(e.to, { from: at, line: e.line });
        queue.push(e.to);
      }
    }
    if (!seen.has(l.a)) continue;
    const points = [l.a];
    const lines = [l.id];
    let at = l.a;
    while (at !== l.b) {
      const step = prev.get(at)!;
      lines.push(step.line);
      at = step.from;
      points.push(at);
    }
    const key = [...lines].sort().join('|');
    if (!loops.has(key)) loops.set(key, { id: `loop:${key}`, points, lines });
  }
  return [...loops.values()];
}

export function loopCoords(sketch: Sketch, loop: Loop): Vec2[] {
  const byId = pointMap(sketch);
  return loop.points.map((id) => {
    const p = byId.get(id)!;
    return [p.x, p.y];
  });
}

function insidePolygon(x: number, y: number, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The smallest closed shape or circle that (x, y) is inside, or null. */
export function shapeAt(
  sketch: Sketch,
  x: number,
  y: number,
): { kind: 'loop'; loop: Loop } | { kind: 'circle'; circle: SketchCircle } | null {
  let best: { kind: 'loop'; loop: Loop } | { kind: 'circle'; circle: SketchCircle } | null = null;
  let bestArea = Infinity;
  for (const loop of findLoops(sketch)) {
    const poly = loopCoords(sketch, loop);
    if (!insidePolygon(x, y, poly)) continue;
    const area = Math.abs(signedArea(poly));
    if (area < bestArea) {
      bestArea = area;
      best = { kind: 'loop', loop };
    }
  }
  const byId = pointMap(sketch);
  for (const c of sketch.circles) {
    const centre = byId.get(c.c);
    if (!centre || Math.hypot(x - centre.x, y - centre.y) > c.r) continue;
    const area = Math.PI * c.r * c.r;
    if (area < bestArea) {
      bestArea = area;
      best = { kind: 'circle', circle: c };
    }
  }
  return best;
}

export function signedArea(poly: Vec2[]): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

export function perimeter(poly: Vec2[]): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    sum += Math.hypot(x2 - x1, y2 - y1);
  }
  return sum;
}

/** Corners and ends of open chains of lines (for "spin into 3D"): the longest simple path, in order. */
export function chainPoints(sketch: Sketch, lineIds: string[]): string[] {
  const lines = sketch.lines.filter((l) => lineIds.includes(l.id));
  if (!lines.length) return [];
  const deg = new Map<string, number>();
  for (const l of lines) {
    deg.set(l.a, (deg.get(l.a) ?? 0) + 1);
    deg.set(l.b, (deg.get(l.b) ?? 0) + 1);
  }
  const start = [...deg.entries()].find(([, d]) => d === 1)?.[0] ?? lines[0].a;
  const used = new Set<string>();
  const order = [start];
  let at = start;
  for (;;) {
    const next = lines.find((l) => !used.has(l.id) && (l.a === at || l.b === at));
    if (!next) break;
    used.add(next.id);
    at = next.a === at ? next.b : next.a;
    if (at === start) break; // closed
    order.push(at);
  }
  return order;
}
