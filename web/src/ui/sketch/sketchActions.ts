import { gate } from '../../account/limits';
import { uid } from '../../engine/math';
import { createObjectNode, PALETTE } from '../../engine/project/defaults';
import { chainPoints, emptySketch, findLoops, loopCoords, pointMap } from '../../engine/sketch/geometry';
import { solve } from '../../engine/sketch/solver';
import { type Placed, pushUpCircle, pushUpLoop, spinChain } from '../../engine/sketch/toThreeD';
import type { Sketch, SketchConstraintType, Vec2 } from '../../engine/types';
import { asUndoStep, useProjectStore } from '../../state/projectStore';
import { useUiStore } from '../../state/uiStore';
import { useSketchUi } from './sketchStore';

/** The open project's sketch (an empty one if it has none yet). */
export function getSketch(): Sketch {
  return useProjectStore.getState().project.sketch ?? emptySketch();
}

/**
 * Change the sketch, then let the solver make every rule hold again.
 * `pinned` points stay where the student put them (the one being dragged).
 */
export function editSketch(recipe: (s: Sketch) => void, opts: { pinned?: Set<string>; step?: boolean } = {}) {
  const run = () =>
    useProjectStore.getState().updateProject((p) => {
      // a plain copy (the store hands us an immer draft, which structuredClone cannot copy)
      const draft: Sketch = JSON.parse(JSON.stringify(p.sketch ?? emptySketch()));
      recipe(draft);
      const { sketch, unmet } = solve(draft, opts.pinned);
      p.sketch = sketch;
      useSketchUi.getState().set({ unmet });
    });
  if (opts.step === false) run();
  else asUndoStep(run);
}

const snapNum = (v: number) => Number(v.toFixed(4));

export function addPoint(x: number, y: number): string {
  const id = uid('pt');
  editSketch((s) => void s.points.push({ id, x: snapNum(x), y: snapNum(y), fixed: false }));
  return id;
}

export function addLine(a: string, b: string): string | null {
  if (a === b) return null;
  const sk = getSketch();
  const existing = sk.lines.find((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a));
  if (existing) return existing.id;
  const id = uid('ln');
  editSketch((s) => void s.lines.push({ id, a, b }));
  return id;
}

export function addCircle(centre: string, r: number): string | null {
  if (!(r > 1e-6)) return null;
  const id = uid('cr');
  editSketch((s) => void s.circles.push({ id, c: centre, r: snapNum(r) }));
  return id;
}

/** Delete points, lines and circles. Deleting a point also deletes the lines and circles using it. */
export function deleteItems(ids: string[]) {
  if (!ids.length) return;
  const gone = new Set(ids);
  editSketch((s) => {
    const usedBefore = new Set([...s.lines.flatMap((l) => [l.a, l.b]), ...s.circles.map((c) => c.c)]);
    s.points = s.points.filter((p) => !gone.has(p.id));
    const alive = new Set(s.points.map((p) => p.id));
    s.lines = s.lines.filter((l) => !gone.has(l.id) && alive.has(l.a) && alive.has(l.b));
    s.circles = s.circles.filter((c) => !gone.has(c.id) && alive.has(c.c));
    const items = new Set([...alive, ...s.lines.map((l) => l.id), ...s.circles.map((c) => c.id)]);
    s.constraints = s.constraints.filter((c) => !gone.has(c.id) && c.refs.every((r) => items.has(r)));
    // tidy: a corner left over from a deleted line or circle goes too (points drawn on their own stay)
    const used = new Set([...s.lines.flatMap((l) => [l.a, l.b]), ...s.circles.map((c) => c.c)]);
    s.points = s.points.filter((p) => used.has(p.id) || !usedBefore.has(p.id) || p.fixed);
  });
  useSketchUi.getState().set({ selection: [], shape: null });
}

export function movePoint(id: string, x: number, y: number, step = false) {
  editSketch(
    (s) => {
      const p = s.points.find((q) => q.id === id);
      if (p) {
        p.x = snapNum(x);
        p.y = snapNum(y);
      }
    },
    { pinned: new Set([id]), step },
  );
}

/** Move several points by the same amount (dragging a line or circle). */
export function movePoints(ids: string[], dx: number, dy: number) {
  const set = new Set(ids);
  editSketch(
    (s) => {
      for (const p of s.points) {
        if (!set.has(p.id) || p.fixed) continue;
        p.x = snapNum(p.x + dx);
        p.y = snapNum(p.y + dy);
      }
    },
    { pinned: set, step: false },
  );
}

export function setRadius(id: string, r: number, step = true) {
  if (!(r > 0)) return;
  editSketch(
    (s) => {
      const c = s.circles.find((k) => k.id === id);
      if (c) c.r = snapNum(r);
      const rule = s.constraints.find((k) => k.type === 'radius' && k.refs[0] === id);
      if (rule) rule.value = snapNum(r);
    },
    { step },
  );
}

export function setPointFixed(ids: string[], fixed: boolean) {
  editSketch((s) => {
    for (const p of s.points) if (ids.includes(p.id)) p.fixed = fixed;
  });
}

/** Change a line's length: the far end moves along the line (and a length rule follows the new value). */
export function setLineLength(id: string, length: number) {
  if (!(length > 0)) return;
  editSketch((s) => {
    const l = s.lines.find((k) => k.id === id);
    if (!l) return;
    const a = s.points.find((p) => p.id === l.a)!;
    const b = s.points.find((p) => p.id === l.b)!;
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const [from, to] = b.fixed && !a.fixed ? [b, a] : [a, b];
    to.x = snapNum(from.x + ((to.x - from.x) / d) * length);
    to.y = snapNum(from.y + ((to.y - from.y) / d) * length);
    const rule = s.constraints.find((k) => k.type === 'length' && k.refs[0] === id);
    if (rule) rule.value = snapNum(length);
  });
}

/** Turn a line to an angle (degrees from horizontal), keeping its first end still. */
export function setLineAngle(id: string, degrees: number) {
  editSketch((s) => {
    const l = s.lines.find((k) => k.id === id);
    if (!l) return;
    const a = s.points.find((p) => p.id === l.a)!;
    const b = s.points.find((p) => p.id === l.b)!;
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const t = (degrees * Math.PI) / 180;
    b.x = snapNum(a.x + d * Math.cos(t));
    b.y = snapNum(a.y + d * Math.sin(t));
  });
}

export function setPointXY(id: string, x: number, y: number) {
  movePoint(id, x, y, true);
}

/** Add a rule. Length and radius rules take the current size unless a value is given. */
export function addConstraint(type: SketchConstraintType, refs: string[], value?: number) {
  const sk = getSketch();
  const byId = pointMap(sk);
  let v = value;
  if (v === undefined && type === 'length') {
    const l = sk.lines.find((k) => k.id === refs[0]);
    const a = l && byId.get(l.a);
    const b = l && byId.get(l.b);
    if (a && b) v = snapNum(Math.hypot(b.x - a.x, b.y - a.y));
  }
  if (v === undefined && type === 'radius') v = sk.circles.find((k) => k.id === refs[0])?.r;
  editSketch((s) => {
    // one rule of a kind per item: replace an old one
    s.constraints = s.constraints.filter(
      (c) => !(c.type === type && c.refs.length === refs.length && c.refs.every((r, i) => r === refs[i])),
    );
    s.constraints.push({ id: uid('rule'), type, refs, ...(v !== undefined ? { value: v } : {}) });
  });
}

export function removeConstraint(id: string) {
  editSketch((s) => void (s.constraints = s.constraints.filter((c) => c.id !== id)));
}

/** The points a selection touches: chosen points, line ends and circle centres. */
export function involvedPoints(sketch: Sketch, ids: string[]): string[] {
  const out = new Set<string>();
  for (const id of ids) {
    if (sketch.points.some((p) => p.id === id)) out.add(id);
    const l = sketch.lines.find((k) => k.id === id);
    if (l) {
      out.add(l.a);
      out.add(l.b);
    }
    const c = sketch.circles.find((k) => k.id === id);
    if (c) out.add(c.c);
  }
  return [...out];
}

/**
 * Copy the selection. `transform` says where each copied point goes. Lines and circles come along when
 * their points do. Returns the new ids (selected afterwards).
 */
function copyWith(ids: string[], transform: (x: number, y: number) => Vec2): string[] {
  const sk = getSketch();
  const pts = involvedPoints(sk, ids);
  if (!pts.length) return [];
  const idMap = new Map(pts.map((id) => [id, uid('pt')]));
  const fresh: string[] = [];
  editSketch((s) => {
    for (const id of pts) {
      const p = s.points.find((q) => q.id === id)!;
      const [x, y] = transform(p.x, p.y);
      s.points.push({ id: idMap.get(id)!, x: snapNum(x), y: snapNum(y), fixed: false });
    }
    for (const l of sk.lines) {
      if (
        ids.includes(l.id) ||
        (idMap.has(l.a) && idMap.has(l.b) && ids.includes(l.a) && ids.includes(l.b))
      ) {
        const id = uid('ln');
        s.lines.push({ id, a: idMap.get(l.a)!, b: idMap.get(l.b)! });
        fresh.push(id);
      }
    }
    for (const c of sk.circles) {
      if (ids.includes(c.id)) {
        const id = uid('cr');
        s.circles.push({ id, c: idMap.get(c.c)!, r: c.r });
        fresh.push(id);
      }
    }
  });
  const result = fresh.length ? fresh : [...idMap.values()];
  useSketchUi.getState().set({ selection: result, shape: null });
  return result;
}

export function copySelection(ids: string[], dx = 1, dy = -1) {
  return copyWith(ids, (x, y) => [x + dx, y + dy]);
}

/**
 * Mirror the selection. If one of the selected items is a line, it is the mirror; otherwise the
 * up-and-down axis (x = 0) is. The mirror image is a copy, like a reflection in maths.
 */
export function mirrorSelection(ids: string[]): 'line' | 'axis' {
  const sk = getSketch();
  const mirrorLine = ids.length > 1 ? sk.lines.find((l) => ids.includes(l.id)) : undefined;
  const rest = mirrorLine ? ids.filter((id) => id !== mirrorLine.id) : ids;
  if (mirrorLine) {
    const byId = pointMap(sk);
    const a = byId.get(mirrorLine.a)!;
    const b = byId.get(mirrorLine.b)!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    copyWith(rest, (x, y) => {
      const t = ((x - a.x) * dx + (y - a.y) * dy) / len2;
      const fx = a.x + t * dx;
      const fy = a.y + t * dy;
      return [2 * fx - x, 2 * fy - y];
    });
    return 'line';
  }
  copyWith(rest, (x, y) => [-x, y]);
  return 'axis';
}

/** Turn the selection about its middle by an angle (degrees, anticlockwise). */
export function rotateSelection(ids: string[], degrees: number) {
  const sk = getSketch();
  const pts = involvedPoints(sk, ids);
  if (!pts.length) return;
  const byId = pointMap(sk);
  const xs = pts.map((id) => byId.get(id)!.x);
  const ys = pts.map((id) => byId.get(id)!.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const t = (degrees * Math.PI) / 180;
  const set = new Set(pts);
  editSketch((s) => {
    for (const p of s.points) {
      if (!set.has(p.id) || p.fixed) continue;
      const dx = p.x - cx;
      const dy = p.y - cy;
      p.x = snapNum(cx + dx * Math.cos(t) - dy * Math.sin(t));
      p.y = snapNum(cy + dx * Math.sin(t) + dy * Math.cos(t));
    }
  });
}

// ---------------------------------------------------------------- into 3D

function addPlaced(placed: Placed, name: string) {
  const store = useProjectStore.getState();
  const node = createObjectNode(
    { kind: 'shape', shape: placed.shape },
    name,
    PALETTE[store.project.nodes.length % PALETTE.length],
  );
  node.transform.position = placed.position;
  node.transform.rotation = placed.rotation;
  store.addNode(node);
  const ui = useUiStore.getState();
  useUiStore.setState({ studioMode: '3d' });
  ui.select(node.id);
  ui.setInspectorTab('shape');
  ui.requestFrame();
}

export function pushUpShape(
  shape: NonNullable<ReturnType<typeof useSketchUi.getState>['shape']>,
  height: number,
) {
  if (!gate({ kind: 'twoDToThreeD' })) return;
  const sk = getSketch();
  if (shape.kind === 'circle') {
    const c = sk.circles.find((k) => k.id === shape.id);
    const centre = c && sk.points.find((p) => p.id === c.c);
    if (c && centre) addPlaced(pushUpCircle([centre.x, centre.y], c.r, height), 'Sketch cylinder');
    return;
  }
  const loop = findLoops(sk).find(
    (l) => l.lines.length === shape.lines.length && l.lines.every((id) => shape.lines.includes(id)),
  );
  if (loop) addPlaced(pushUpLoop(loopCoords(sk, loop), height), 'Sketch solid');
}

/** Spin lines around the up-and-down axis (x = 0) into a 3D object. */
export function spinLines(lineIds: string[], closed: boolean): boolean {
  if (!gate({ kind: 'twoDToThreeD' })) return false;
  const sk = getSketch();
  const byId = pointMap(sk);
  const order = chainPoints(sk, lineIds).map((id) => {
    const p = byId.get(id)!;
    return [p.x, p.y] as Vec2;
  });
  if (closed && order.length > 2) order.push(order[0]);
  const placed = spinChain(order);
  if (!placed) return false;
  addPlaced(placed, 'Spun sketch');
  return true;
}
