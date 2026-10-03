import type { Sketch, SketchConstraint } from '../types';

/**
 * A small constraint solver for the 2D sketch. It nudges points again and again until every rule
 * (horizontal, vertical, length, parallel, perpendicular, radius, fixed) holds, a bit like relaxing a
 * spring network. Good enough for school drawings; it reports the rules it could not satisfy.
 */

const TOLERANCE = 1e-4;

interface P {
  x: number;
  y: number;
  locked: boolean;
}

export interface SolveResult {
  sketch: Sketch;
  /** Constraint ids that are still not met (they fight each other, or a fixed point blocks them). */
  unmet: string[];
}

function rotateAbout(p: P, cx: number, cy: number, angle: number) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const dx = p.x - cx;
  const dy = p.y - cy;
  p.x = cx + dx * c - dy * s;
  p.y = cy + dx * s + dy * c;
}

/** Turn the line a–b to the given direction (radians), about its middle or about whichever end is locked. */
function turnLine(a: P, b: P, target: number) {
  if (a.locked && b.locked) return;
  const current = Math.atan2(b.y - a.y, b.x - a.x);
  // a line has no arrow: turn to whichever of the two opposite directions is closer
  let delta = target - current;
  delta = Math.atan2(Math.sin(delta), Math.cos(delta));
  if (delta > Math.PI / 2) delta -= Math.PI;
  if (delta < -Math.PI / 2) delta += Math.PI;
  if (a.locked) rotateAbout(b, a.x, a.y, delta);
  else if (b.locked) rotateAbout(a, b.x, b.y, delta);
  else {
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    rotateAbout(a, cx, cy, delta);
    rotateAbout(b, cx, cy, delta);
  }
}

function lineDir(a: P, b: P) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/** How far a rule is from being met (0 = met). */
function error(
  c: SketchConstraint,
  ends: (lineId: string) => [P, P] | null,
  radius: (circleId: string) => number | null,
): number {
  if (c.type === 'horizontal' || c.type === 'vertical') {
    const e = ends(c.refs[0]);
    if (!e) return 0;
    return c.type === 'horizontal' ? Math.abs(e[0].y - e[1].y) : Math.abs(e[0].x - e[1].x);
  }
  if (c.type === 'length') {
    const e = ends(c.refs[0]);
    if (!e || c.value === undefined) return 0;
    return Math.abs(Math.hypot(e[1].x - e[0].x, e[1].y - e[0].y) - c.value);
  }
  if (c.type === 'radius') {
    const r = radius(c.refs[0]);
    return r === null || c.value === undefined ? 0 : Math.abs(r - c.value);
  }
  if (c.type === 'parallel' || c.type === 'perpendicular') {
    const e1 = ends(c.refs[0]);
    const e2 = ends(c.refs[1] ?? '');
    if (!e1 || !e2) return 0;
    const u = [e1[1].x - e1[0].x, e1[1].y - e1[0].y];
    const v = [e2[1].x - e2[0].x, e2[1].y - e2[0].y];
    const lu = Math.hypot(u[0], u[1]);
    const lv = Math.hypot(v[0], v[1]);
    if (lu < 1e-9 || lv < 1e-9) return 0;
    const cross = Math.abs(u[0] * v[1] - u[1] * v[0]) / (lu * lv);
    const dot = Math.abs(u[0] * v[0] + u[1] * v[1]) / (lu * lv);
    return c.type === 'parallel' ? cross : dot;
  }
  return 0;
}

/**
 * Move points so the rules hold. `pinned` points stay put this time (e.g. the one being dragged).
 * Returns a new sketch; the input is not changed.
 */
export function solve(sketch: Sketch, pinned: Set<string> = new Set(), iterations = 80): SolveResult {
  const fixedByRule = new Set(sketch.constraints.filter((c) => c.type === 'fixed').map((c) => c.refs[0]));
  const pts = new Map<string, P>(
    sketch.points.map((p) => [
      p.id,
      { x: p.x, y: p.y, locked: p.fixed || fixedByRule.has(p.id) || pinned.has(p.id) },
    ]),
  );
  const lineById = new Map(sketch.lines.map((l) => [l.id, l]));
  const ends = (id: string): [P, P] | null => {
    const l = lineById.get(id);
    if (!l) return null;
    const a = pts.get(l.a);
    const b = pts.get(l.b);
    return a && b && a !== b ? [a, b] : null;
  };
  const circles = sketch.circles.map((c) => ({ ...c }));
  const radius = (id: string) => circles.find((c) => c.id === id)?.r ?? null;

  // radii are numbers on the circle, not point positions: set them straight away
  for (const c of sketch.constraints) {
    if (c.type === 'radius' && c.value !== undefined && c.value > 0) {
      const circle = circles.find((k) => k.id === c.refs[0]);
      if (circle) circle.r = c.value;
    }
  }

  const rules = sketch.constraints.filter((c) => c.type !== 'fixed' && c.type !== 'radius');
  for (let it = 0; it < iterations; it++) {
    let worst = 0;
    for (const c of rules) {
      const err = error(c, ends, radius);
      worst = Math.max(worst, err);
      if (err < TOLERANCE) continue;
      if (c.type === 'horizontal' || c.type === 'vertical') {
        const e = ends(c.refs[0]);
        if (!e) continue;
        const [a, b] = e;
        const key = c.type === 'horizontal' ? 'y' : 'x';
        if (a.locked && b.locked) continue;
        const target = a.locked ? a[key] : b.locked ? b[key] : (a[key] + b[key]) / 2;
        if (!a.locked) a[key] = target;
        if (!b.locked) b[key] = target;
      } else if (c.type === 'length' && c.value !== undefined) {
        const e = ends(c.refs[0]);
        if (!e) continue;
        const [a, b] = e;
        if (a.locked && b.locked) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d < 1e-9) {
          dx = 1;
          dy = 0;
          d = 1;
        }
        const diff = (c.value - Math.hypot(b.x - a.x, b.y - a.y)) / d;
        const share = a.locked || b.locked ? 1 : 0.5;
        if (!b.locked) {
          b.x += dx * diff * share;
          b.y += dy * diff * share;
        }
        if (!a.locked) {
          a.x -= dx * diff * share;
          a.y -= dy * diff * share;
        }
      } else if (c.type === 'parallel' || c.type === 'perpendicular') {
        const e1 = ends(c.refs[0]);
        const e2 = ends(c.refs[1] ?? '');
        if (!e1 || !e2) continue;
        const turn = c.type === 'perpendicular' ? Math.PI / 2 : 0;
        // turn the line that can move; if both can, turn each half way
        const free2 = !(e2[0].locked && e2[1].locked);
        const free1 = !(e1[0].locked && e1[1].locked);
        if (free1 && free2) {
          const d1 = lineDir(...e1);
          const d2 = lineDir(...e2);
          let delta = d1 + turn - d2;
          delta = Math.atan2(Math.sin(delta), Math.cos(delta));
          if (delta > Math.PI / 2) delta -= Math.PI;
          if (delta < -Math.PI / 2) delta += Math.PI;
          turnLine(e2[0], e2[1], d2 + delta / 2);
          turnLine(e1[0], e1[1], d1 - delta / 2);
        } else if (free2) turnLine(e2[0], e2[1], lineDir(...e1) + turn);
        else if (free1) turnLine(e1[0], e1[1], lineDir(...e2) - turn);
      }
    }
    if (worst < TOLERANCE) break;
  }

  const unmet = sketch.constraints.filter((c) => error(c, ends, radius) > 1e-3).map((c) => c.id);
  const round = (v: number) => Math.round(v * 1e6) / 1e6;
  return {
    sketch: {
      ...sketch,
      points: sketch.points.map((p) => {
        const s = pts.get(p.id)!;
        return { ...p, x: round(s.x), y: round(s.y) };
      }),
      circles,
    },
    unmet,
  };
}
