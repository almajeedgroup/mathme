import { NumberInput, Paper, Text } from '@mantine/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { fmt } from '../../engine/math';
import {
  emptySketch,
  findLoops,
  loopCoords,
  pick,
  pointMap,
  shapeAt,
  snap,
  type SnapResult,
} from '../../engine/sketch/geometry';
import { useProjectStore } from '../../state/projectStore';
import {
  addCircle,
  addLine,
  addPoint,
  involvedPoints,
  movePoint,
  movePoints,
  setRadius,
} from './sketchActions';
import { type SketchTool, useSketchUi } from './sketchStore';

const SNAP_PX = 12;
const PICK_PX = 9;

type Drag =
  | { kind: 'pan'; sx: number; sy: number; cx: number; cy: number }
  | { kind: 'point'; id: string }
  | { kind: 'move'; ids: string[]; lastX: number; lastY: number }
  | { kind: 'rim'; id: string }
  | { kind: 'box'; x0: number; y0: number; x1: number; y1: number };

/** Grid step in sketch units for the current zoom: about every 20-60 pixels, in 1-2-5 steps. */
function gridStep(scale: number): number {
  const target = 28 / scale;
  const pow = 10 ** Math.floor(Math.log10(target));
  for (const m of [1, 2, 5, 10]) if (m * pow >= target) return m * pow;
  return 10 * pow;
}

const CONSTRAINT_MARK: Record<string, string> = {
  horizontal: 'H',
  vertical: 'V',
  parallel: '∥',
  perpendicular: '⊥',
  length: '↔',
};

export function SketchCanvas() {
  const sketch = useProjectStore((s) => s.project.sketch) ?? emptySketch();
  const units = useProjectStore((s) => s.project.units);
  const ui = useSketchUi();
  const { view, tool } = ui;
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [hover, setHover] = useState<SnapResult | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toScreen = useCallback(
    (x: number, y: number): [number, number] => [
      size.w / 2 + (x - view.cx) * view.scale,
      size.h / 2 - (y - view.cy) * view.scale,
    ],
    [size, view],
  );
  const toWorld = useCallback(
    (sx: number, sy: number): [number, number] => [
      view.cx + (sx - size.w / 2) / view.scale,
      view.cy - (sy - size.h / 2) / view.scale,
    ],
    [size, view],
  );

  const step = gridStep(view.scale);
  const byId = useMemo(() => pointMap(sketch), [sketch]);
  const loops = useMemo(() => findLoops(sketch), [sketch]);
  const selected = new Set(ui.selection);
  const unmet = new Set(ui.unmet);

  const local = (e: React.PointerEvent | React.WheelEvent | React.MouseEvent): [number, number] => {
    const r = wrap.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const snapAt = (sx: number, sy: number, exclude?: Set<string>): SnapResult => {
    const [x, y] = toWorld(sx, sy);
    const opts = { tolerance: SNAP_PX / view.scale, grid: ui.snapOn ? step : null, exclude };
    const s = snap(sketch, x, y, opts);
    // with snapping off, only joining onto an existing point still happens
    if (!ui.snapOn && s.kind !== 'point') return { x, y, kind: 'none' };
    return s;
  };
  /** The point under the cursor, or a new one where it snaps. */
  const pointAt = (s: SnapResult): string => s.pointId ?? addPoint(s.x, s.y);

  // keyboard: space to pan, Escape to stop a line or circle
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      if (e.code === 'Space') {
        setSpaceDown(true);
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const [sx, sy] = local(e);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (e.button === 1 || e.button === 2 || spaceDown || tool === 'pan') {
      setDrag({ kind: 'pan', sx, sy, cx: view.cx, cy: view.cy });
      return;
    }
    if (e.button !== 0) return;
    const [x, y] = toWorld(sx, sy);
    const tol = PICK_PX / view.scale;

    if (tool === 'select') {
      const hit = pick(sketch, x, y, tol);
      // grabbing the edge of a selected circle changes its radius
      const rimCircle = hit && sketch.circles.find((c) => c.id === hit);
      if (hit) {
        const already = selected.has(hit);
        const selection = e.shiftKey
          ? already
            ? ui.selection.filter((i) => i !== hit)
            : [...ui.selection, hit]
          : already
            ? ui.selection
            : [hit];
        ui.set({ selection, shape: null });
        if (rimCircle && already && !e.shiftKey) setDrag({ kind: 'rim', id: rimCircle.id });
        else if (sketch.points.some((p) => p.id === hit) && selection.length === 1)
          setDrag({ kind: 'point', id: hit });
        else setDrag({ kind: 'move', ids: involvedPoints(sketch, selection), lastX: x, lastY: y });
        return;
      }
      const shape = shapeAt(sketch, x, y);
      if (shape) {
        ui.set(
          shape.kind === 'circle'
            ? { shape: { kind: 'circle', id: shape.circle.id }, selection: [shape.circle.id] }
            : {
                shape: { kind: 'loop', points: shape.loop.points, lines: shape.loop.lines },
                selection: shape.loop.lines,
              },
        );
        return;
      }
      if (!e.shiftKey) ui.set({ selection: [], shape: null });
      setDrag({ kind: 'box', x0: sx, y0: sy, x1: sx, y1: sy });
      return;
    }

    const s = snapAt(sx, sy);
    if (tool === 'point') {
      const id = pointAt(s);
      ui.set({ selection: [id], shape: null });
    } else if (tool === 'line') {
      const id = pointAt(s);
      const from = ui.chainFrom;
      if (from && from !== id) {
        const line = addLine(from, id);
        // clicking the first corner of the chain closes the shape and ends the chain
        const closes = id === ui.chainStart;
        ui.set({
          chainFrom: closes ? null : id,
          chainStart: closes ? null : ui.chainStart,
          selection: line ? [line] : [],
          shape: null,
        });
      } else if (!from) {
        ui.set({ chainFrom: id, chainStart: id, selection: [], shape: null });
      }
    } else if (tool === 'circle') {
      if (!ui.circleCentre) {
        ui.set({ circleCentre: pointAt(s), selection: [], shape: null });
      } else {
        const c = byId.get(ui.circleCentre);
        const r = c ? Math.hypot(s.x - c.x, s.y - c.y) : 0;
        const id = addCircle(ui.circleCentre, r);
        ui.set({ circleCentre: null, selection: id ? [id] : [], shape: null });
      }
    }
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const [sx, sy] = local(e);
    if (drag?.kind === 'pan') {
      ui.set({
        view: {
          ...view,
          cx: drag.cx - (sx - drag.sx) / view.scale,
          cy: drag.cy + (sy - drag.sy) / view.scale,
        },
      });
      return;
    }
    if (drag?.kind === 'point') {
      const s = snapAt(sx, sy, new Set([drag.id]));
      setHover(s);
      movePoint(drag.id, s.x, s.y);
      return;
    }
    if (drag?.kind === 'move') {
      const [x, y] = toWorld(sx, sy);
      const g = ui.snapOn ? step : 0;
      let dx = x - drag.lastX;
      let dy = y - drag.lastY;
      if (g) {
        dx = Math.round(dx / g) * g;
        dy = Math.round(dy / g) * g;
      }
      if (dx || dy) {
        movePoints(drag.ids, dx, dy);
        setDrag({ ...drag, lastX: drag.lastX + dx, lastY: drag.lastY + dy });
      }
      return;
    }
    if (drag?.kind === 'rim') {
      const c = sketch.circles.find((k) => k.id === drag.id);
      const centre = c && byId.get(c.c);
      if (c && centre) {
        const s = snapAt(sx, sy);
        setRadius(c.id, Math.max(step / 4, Math.hypot(s.x - centre.x, s.y - centre.y)), false);
      }
      return;
    }
    if (drag?.kind === 'box') {
      setDrag({ ...drag, x1: sx, y1: sy });
      return;
    }
    setHover(tool === 'select' || tool === 'pan' ? null : snapAt(sx, sy));
  };

  const onPointerUp = () => {
    if (drag?.kind === 'box') {
      const [ax, ay] = toWorld(Math.min(drag.x0, drag.x1), Math.max(drag.y0, drag.y1));
      const [bx, by] = toWorld(Math.max(drag.x0, drag.x1), Math.min(drag.y0, drag.y1));
      if (Math.abs(drag.x1 - drag.x0) > 4 || Math.abs(drag.y1 - drag.y0) > 4) {
        const inside = (id: string) => {
          const p = byId.get(id);
          return !!p && p.x >= ax && p.x <= bx && p.y >= ay && p.y <= by;
        };
        const ids = [
          ...sketch.points.filter((p) => inside(p.id)).map((p) => p.id),
          ...sketch.lines.filter((l) => inside(l.a) && inside(l.b)).map((l) => l.id),
          ...sketch.circles.filter((c) => inside(c.c)).map((c) => c.id),
        ];
        ui.set({ selection: [...new Set([...ui.selection, ...ids])], shape: null });
      }
    }
    setDrag(null);
  };

  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    const [sx, sy] = local(e);
    const [wx, wy] = toWorld(sx, sy);
    const scale = Math.min(800, Math.max(4, view.scale * Math.exp(-e.deltaY * 0.0015)));
    // keep the point under the cursor still
    ui.set({
      view: { scale, cx: wx - (sx - size.w / 2) / scale, cy: wy + (sy - size.h / 2) / scale },
    });
  };

  // ------------------------------------------------------------- drawing
  const grid = [];
  const [minX, maxY] = toWorld(0, 0);
  const [maxX, minY] = toWorld(size.w, size.h);
  for (let gx = Math.floor(minX / step) * step; gx <= maxX; gx += step) {
    const [px] = toScreen(gx, 0);
    const major = Math.abs(Math.round(gx / step) % 5) === 0;
    grid.push(
      <line
        key={`x${gx}`}
        x1={px}
        x2={px}
        y1={0}
        y2={size.h}
        className={major ? 'sk-grid-major' : 'sk-grid'}
      />,
    );
  }
  for (let gy = Math.floor(minY / step) * step; gy <= maxY; gy += step) {
    const [, py] = toScreen(0, gy);
    const major = Math.abs(Math.round(gy / step) % 5) === 0;
    grid.push(
      <line
        key={`y${gy}`}
        x1={0}
        x2={size.w}
        y1={py}
        y2={py}
        className={major ? 'sk-grid-major' : 'sk-grid'}
      />,
    );
  }
  const [ox, oy] = toScreen(0, 0);

  const ruleFor = (id: string) => sketch.constraints.filter((c) => c.refs[0] === id || c.refs[1] === id);
  const shapeLines = new Set(ui.shape?.kind === 'loop' ? ui.shape.lines : []);
  const chainFrom = ui.chainFrom ? byId.get(ui.chainFrom) : undefined;
  const circleCentre = ui.circleCentre ? byId.get(ui.circleCentre) : undefined;

  return (
    <div ref={wrap} className="sk-wrap" data-testid="sketch-canvas">
      <svg
        width={size.w}
        height={size.h}
        className={`sk-board sk-tool-${tool}${spaceDown || drag?.kind === 'pan' ? ' sk-panning' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setHover(null)}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
        onDoubleClick={() => ui.set({ chainFrom: null, chainStart: null, circleCentre: null })}
        role="application"
        aria-label="2D sketch board"
      >
        {grid}
        <line x1={ox} x2={ox} y1={0} y2={size.h} className="sk-axis" />
        <line x1={0} x2={size.w} y1={oy} y2={oy} className="sk-axis" />

        {/* closed shapes, lightly filled */}
        {loops.map((loop) => {
          const pts = loopCoords(sketch, loop)
            .map(([x, y]) => toScreen(x, y).join(','))
            .join(' ');
          const isSel = loop.lines.every((l) => shapeLines.has(l)) && shapeLines.size === loop.lines.length;
          return <polygon key={loop.id} points={pts} className={isSel ? 'sk-fill sk-fill-sel' : 'sk-fill'} />;
        })}

        {sketch.circles.map((c) => {
          const centre = byId.get(c.c);
          if (!centre) return null;
          const [cx, cy] = toScreen(centre.x, centre.y);
          const r = c.r * view.scale;
          const isSel = selected.has(c.id);
          const bad = ruleFor(c.id).some((k) => unmet.has(k.id));
          return (
            <g key={c.id}>
              <circle
                cx={cx}
                cy={cy}
                r={r}
                className={`sk-shape${isSel ? ' sk-sel' : ''}${bad ? ' sk-bad' : ''}${ui.shape?.kind === 'circle' && ui.shape.id === c.id ? ' sk-fill-sel' : ''}`}
                data-testid="sketch-circle"
              />
              {ui.showMeasures && (
                <>
                  <line x1={cx} y1={cy} x2={cx + r} y2={cy} className="sk-dim-line" />
                  <text x={cx + r / 2} y={cy - 6} className="sk-dim" textAnchor="middle">
                    r = {fmt(c.r)}
                  </text>
                </>
              )}
            </g>
          );
        })}

        {sketch.lines.map((l) => {
          const a = byId.get(l.a);
          const b = byId.get(l.b);
          if (!a || !b) return null;
          const [x1, y1] = toScreen(a.x, a.y);
          const [x2, y2] = toScreen(b.x, b.y);
          const isSel = selected.has(l.id);
          const rules = ruleFor(l.id);
          const bad = rules.some((k) => unmet.has(k.id));
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          const len = Math.hypot(b.x - a.x, b.y - a.y);
          // label on the outside of the line
          const nx = -(y2 - y1) / (Math.hypot(x2 - x1, y2 - y1) || 1);
          const ny = (x2 - x1) / (Math.hypot(x2 - x1, y2 - y1) || 1);
          const marks = rules
            .map((k) => CONSTRAINT_MARK[k.type])
            .filter(Boolean)
            .join(' ');
          return (
            <g key={l.id}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                className={`sk-line${isSel ? ' sk-sel' : ''}${bad ? ' sk-bad' : ''}`}
                data-testid="sketch-line"
              />
              {ui.showMeasures && len > 0 && (
                <text x={mx + nx * 14} y={my + ny * 14 + 4} className="sk-dim" textAnchor="middle">
                  {fmt(len)}
                </text>
              )}
              {marks && (
                <text
                  x={mx - nx * 14}
                  y={my - ny * 14 + 4}
                  className={`sk-mark${bad ? ' sk-bad-text' : ''}`}
                  textAnchor="middle"
                >
                  {marks}
                </text>
              )}
            </g>
          );
        })}

        {sketch.points.map((p) => {
          const [x, y] = toScreen(p.x, p.y);
          const isSel = selected.has(p.id);
          return p.fixed ? (
            <rect
              key={p.id}
              x={x - 5}
              y={y - 5}
              width={10}
              height={10}
              className={`sk-point sk-fixed${isSel ? ' sk-sel' : ''}`}
            />
          ) : (
            <circle
              key={p.id}
              cx={x}
              cy={y}
              r={isSel ? 6 : 4.5}
              className={`sk-point${isSel ? ' sk-sel' : ''}`}
              data-testid="sketch-point"
            />
          );
        })}

        {/* previews while drawing */}
        {tool === 'line' && chainFrom && hover && (
          <g>
            <line
              {...lineProps(toScreen(chainFrom.x, chainFrom.y), toScreen(hover.x, hover.y))}
              className="sk-preview"
            />
            <text
              {...mid(toScreen(chainFrom.x, chainFrom.y), toScreen(hover.x, hover.y))}
              className="sk-dim"
              textAnchor="middle"
            >
              {fmt(Math.hypot(hover.x - chainFrom.x, hover.y - chainFrom.y))}
            </text>
          </g>
        )}
        {tool === 'circle' && circleCentre && hover && (
          <g>
            <circle
              cx={toScreen(circleCentre.x, circleCentre.y)[0]}
              cy={toScreen(circleCentre.x, circleCentre.y)[1]}
              r={Math.hypot(hover.x - circleCentre.x, hover.y - circleCentre.y) * view.scale}
              className="sk-preview"
            />
            <text
              {...mid(toScreen(circleCentre.x, circleCentre.y), toScreen(hover.x, hover.y))}
              className="sk-dim"
              textAnchor="middle"
            >
              r = {fmt(Math.hypot(hover.x - circleCentre.x, hover.y - circleCentre.y))}
            </text>
          </g>
        )}
        {hover && hover.guide && (
          <line
            {...lineProps(toScreen(hover.guide.x, hover.guide.y), toScreen(hover.x, hover.y))}
            className="sk-guide"
          />
        )}
        {hover && hover.kind !== 'none' && (
          <circle
            cx={toScreen(hover.x, hover.y)[0]}
            cy={toScreen(hover.x, hover.y)[1]}
            r={8}
            className={`sk-snap sk-snap-${hover.kind}`}
          />
        )}
        {drag?.kind === 'box' && (
          <rect
            x={Math.min(drag.x0, drag.x1)}
            y={Math.min(drag.y0, drag.y1)}
            width={Math.abs(drag.x1 - drag.x0)}
            height={Math.abs(drag.y1 - drag.y0)}
            className="sk-box"
          />
        )}
      </svg>

      {tool === 'circle' && circleCentre && <RadiusBox centreId={ui.circleCentre!} />}
      <Text size="xs" c="dimmed" className="sk-status" data-testid="sketch-status">
        {[
          hover ? `x ${fmt(hover.x)}, y ${fmt(hover.y)} ${units}` : null,
          hover && hover.kind !== 'none' && hover.kind !== 'grid'
            ? `on ${hover.kind === 'align' ? 'a line-up guide' : `a ${hover.kind}`}`
            : null,
          `grid ${fmt(step)} ${units}`,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      <Text size="xs" c="dimmed" className="sk-hint">
        {HINTS[tool]}
      </Text>
    </div>
  );
}

const HINTS: Record<SketchTool, string> = {
  select: 'Click to select, drag to move, Shift for more. Click inside a shape to measure it.',
  point: 'Click to place a point.',
  line: 'Click point to point. Click the first point to close the shape; Esc or double-click to stop.',
  circle: 'Click the centre, then click (or type) the radius.',
  pan: 'Drag to move around. Scroll to zoom.',
};

function lineProps([x1, y1]: [number, number], [x2, y2]: [number, number]) {
  return { x1, y1, x2, y2 };
}

function mid([x1, y1]: [number, number], [x2, y2]: [number, number]) {
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 8 };
}

/** Type the radius instead of clicking it. */
function RadiusBox({ centreId }: { centreId: string }) {
  const [value, setValue] = useState<number | string>('');
  const set = useSketchUi((s) => s.set);
  return (
    <Paper className="sk-radius-box mm-float" p={6}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const r = typeof value === 'number' ? value : parseFloat(value);
          if (r > 0) {
            const id = addCircle(centreId, r);
            set({ circleCentre: null, selection: id ? [id] : [], shape: null });
          }
        }}
      >
        <NumberInput
          size="xs"
          w={150}
          radius="xl"
          min={0.01}
          decimalScale={3}
          placeholder="Radius, then Enter"
          value={value}
          onChange={setValue}
          aria-label="Circle radius"
          data-testid="sketch-radius-input"
        />
      </form>
    </Paper>
  );
}
