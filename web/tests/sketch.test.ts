import { describe, expect, it } from 'vitest';

import { angleBetween, findLoops, loopCoords, pick, shapeAt, snap } from '../src/engine/sketch/geometry';
import { circleFormulas, loopFormulas } from '../src/engine/sketch/measure';
import { solve } from '../src/engine/sketch/solver';
import { pushUpCircle, pushUpLoop, spinChain } from '../src/engine/sketch/toThreeD';
import type { Sketch } from '../src/engine/types';

const P = (id: string, x: number, y: number, fixed = false) => ({ id, x, y, fixed });
const L = (id: string, a: string, b: string) => ({ id, a, b });

function triangle(): Sketch {
  return {
    points: [P('a', 0, 0), P('b', 3, 0), P('c', 3, 4)],
    lines: [L('ab', 'a', 'b'), L('bc', 'b', 'c'), L('ca', 'c', 'a')],
    circles: [],
    constraints: [],
  };
}

describe('sketch geometry', () => {
  it('snaps to points first, then midpoints, circles, alignment and the grid', () => {
    const s: Sketch = { ...triangle(), circles: [{ id: 'k', c: 'a', r: 10 }] };
    expect(snap(s, 3.1, 0.05, { tolerance: 0.3, grid: 1 })).toMatchObject({ kind: 'point', pointId: 'b' });
    expect(snap(s, 1.45, 0.1, { tolerance: 0.3, grid: 1 })).toMatchObject({ kind: 'midpoint', x: 1.5, y: 0 });
    expect(snap(s, 0.05, 10.1, { tolerance: 0.3, grid: 1 })).toMatchObject({ kind: 'circle' });
    expect(snap(s, 3.05, 7.6, { tolerance: 0.3, grid: 1 })).toMatchObject({ kind: 'align', x: 3, y: 8 });
    expect(snap(s, 6.4, 1.6, { tolerance: 0.3, grid: 1 })).toMatchObject({ kind: 'grid', x: 6, y: 2 });
    expect(snap(s, 6.4, 1.6, { tolerance: 0.3, grid: null })).toMatchObject({ kind: 'none', x: 6.4, y: 1.6 });
  });

  it('picks points before lines and lines before circles', () => {
    const s = triangle();
    expect(pick(s, 0.05, 0.05, 0.2)).toBe('a');
    expect(pick(s, 1.5, 0.1, 0.2)).toBe('ab');
    expect(pick(s, 10, 10, 0.2)).toBeNull();
  });

  it('finds a triangle drawn as three lines, and two triangles sharing an edge', () => {
    expect(findLoops(triangle())).toHaveLength(1);
    const s = triangle();
    s.points.push(P('d', 0, 4));
    s.lines.push(L('cd', 'c', 'd'), L('da', 'd', 'a'));
    const loops = findLoops(s);
    expect(loops).toHaveLength(2);
    expect(shapeAt(s, 2.5, 1)?.kind).toBe('loop');
  });

  it('measures the 3-4-5 triangle with the shoelace formula', () => {
    const s = triangle();
    const poly = loopCoords(s, findLoops(s)[0]);
    const f = loopFormulas(poly);
    expect(f.find((x) => x.quantity === 'Area')!.value).toBeCloseTo(6);
    expect(f.find((x) => x.quantity === 'Perimeter')!.value).toBeCloseTo(12);
    expect(f.find((x) => x.quantity.startsWith('Inside'))!.value).toBe(180);
    expect(circleFormulas({ id: 'k', c: 'a', r: 2 }).find((x) => x.quantity === 'Area')!.value).toBeCloseTo(
      Math.PI * 4,
    );
  });

  it('gives the angle at a shared corner', () => {
    const s = triangle();
    expect(angleBetween(s, s.lines[0], s.lines[1]).degrees).toBeCloseTo(90);
  });
});

describe('sketch solver', () => {
  it('makes a line horizontal or vertical', () => {
    const s: Sketch = {
      points: [P('a', 0, 0), P('b', 4, 1)],
      lines: [L('l', 'a', 'b')],
      circles: [],
      constraints: [{ id: 'h', type: 'horizontal', refs: ['l'] }],
    };
    const r = solve(s);
    expect(r.unmet).toEqual([]);
    expect(r.sketch.points[0].y).toBeCloseTo(r.sketch.points[1].y);
    const v = solve({ ...s, constraints: [{ id: 'v', type: 'vertical', refs: ['l'] }] });
    expect(v.sketch.points[0].x).toBeCloseTo(v.sketch.points[1].x);
  });

  it('keeps fixed and pinned points still', () => {
    const s: Sketch = {
      points: [P('a', 0, 0, true), P('b', 4, 3)],
      lines: [L('l', 'a', 'b')],
      circles: [],
      constraints: [{ id: 'len', type: 'length', refs: ['l'], value: 10 }],
    };
    const r = solve(s);
    expect(r.sketch.points[0]).toMatchObject({ x: 0, y: 0 });
    expect(Math.hypot(r.sketch.points[1].x, r.sketch.points[1].y)).toBeCloseTo(10);
    expect(r.sketch.points[1].x / r.sketch.points[1].y).toBeCloseTo(4 / 3); // same direction
  });

  it('makes lines parallel and perpendicular', () => {
    const s: Sketch = {
      points: [P('a', 0, 0), P('b', 4, 0), P('c', 0, 2), P('d', 4, 3)],
      lines: [L('l1', 'a', 'b'), L('l2', 'c', 'd')],
      circles: [],
      constraints: [{ id: 'p', type: 'parallel', refs: ['l1', 'l2'] }],
    };
    const r = solve(s);
    expect(r.unmet).toEqual([]);
    expect(angleBetween(r.sketch, r.sketch.lines[0], r.sketch.lines[1]).degrees).toBeCloseTo(0, 2);
    const q = solve({ ...s, constraints: [{ id: 'q', type: 'perpendicular', refs: ['l1', 'l2'] }] });
    expect(angleBetween(q.sketch, q.sketch.lines[0], q.sketch.lines[1]).degrees).toBeCloseTo(90, 2);
  });

  it('sets a fixed radius and reports rules that fight', () => {
    const s: Sketch = {
      points: [P('a', 0, 0, true), P('b', 4, 3, true)],
      lines: [L('l', 'a', 'b')],
      circles: [{ id: 'k', c: 'a', r: 1 }],
      constraints: [
        { id: 'r', type: 'radius', refs: ['k'], value: 2.5 },
        { id: 'h', type: 'horizontal', refs: ['l'] },
      ],
    };
    const r = solve(s);
    expect(r.sketch.circles[0].r).toBe(2.5);
    expect(r.unmet).toEqual(['h']); // both ends are fixed, so it cannot be made horizontal
  });
});

describe('sketch to 3D', () => {
  it('pushes a loop up into an extrude standing on the floor', () => {
    const placed = pushUpLoop(
      [
        [0, 0],
        [4, 0],
        [4, 2],
      ],
      3,
    );
    expect(placed.shape.type).toBe('extrude');
    expect(placed.position).toEqual([2, 1.5, -1]);
    expect(placed.rotation).toEqual([-90, 0, 0]);
    expect(placed.shape.params.outline).toEqual([
      [-2, -1],
      [2, -1],
      [2, 1],
    ]);
  });

  it('pushes a circle up into a cylinder and spins a chain into a lathe', () => {
    expect(pushUpCircle([1, 2], 3, 4)).toMatchObject({
      shape: { type: 'cylinder', params: { radiusTop: 3, radiusBottom: 3, height: 4 } },
      position: [1, 2, -2],
    });
    const spun = spinChain([
      [0, 0],
      [-2, 1],
      [1, 4],
    ])!;
    expect(spun.shape.params.profile).toEqual([
      [0, 0],
      [2, 1],
      [1, 4],
    ]);
    expect(spun.position[1]).toBe(2);
  });
});

describe('sketch files', () => {
  const sketch: Sketch = {
    points: [P('a', 0, 0), P('b', 3, 0), P('c', 3, 4), P('lonely', 9, 9)],
    lines: [L('ab', 'a', 'b'), L('bc', 'b', 'c'), L('ca', 'c', 'a')],
    circles: [{ id: 'k', c: 'a', r: 2 }],
    constraints: [],
  };

  it('writes an SVG at real size with the y axis flipped', async () => {
    const { sketchToSvg } = await import('../src/export/sketch');
    const svg = sketchToSvg(sketch, 'cm', { measures: true });
    expect(svg.match(/<line /g)).toHaveLength(3);
    expect(svg.match(/<circle /g)).toHaveLength(1);
    expect(svg).toContain('x1="3" y1="0" x2="3" y2="-4"');
    expect(svg).toMatch(/width="[\d.]+cm"/);
    expect(svg).toContain('>5</text>'); // the hypotenuse
  });

  it('writes a DXF with lines, circles, lone points and the units', async () => {
    const { sketchToDxf } = await import('../src/export/sketch');
    const dxf = sketchToDxf(sketch, 'mm').split('\n');
    const count = (name: string) => dxf.filter((row, i) => row === name && dxf[i - 1] === '0').length;
    expect(count('LINE')).toBe(3);
    expect(count('CIRCLE')).toBe(1);
    expect(count('POINT')).toBe(1);
    expect(dxf[dxf.indexOf('$INSUNITS') + 2]).toBe('4');
    expect(dxf.at(-2)).toBe('EOF');
  });
});
