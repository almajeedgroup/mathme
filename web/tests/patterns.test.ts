import { describe, expect, it } from 'vitest';

import {
  defaultVariation,
  shapeSource,
  createPatternNode,
  specExampleNode,
} from '../src/engine/project/defaults';
import { layoutPattern, MAX_OBJECTS, sizeAt } from '../src/engine/layout';
import { GOLDEN_ANGLE_DEG } from '../src/engine/math';
import { PATTERN_LIST, getPattern } from '../src/engine/patterns/registry';
import { createRng } from '../src/engine/rng';
import { Matrix4, Vector3 } from 'three';

const len = (v: number[]) => Math.hypot(v[0], v[1], v[2]);

describe('patterns', () => {
  for (const def of PATTERN_LIST) {
    it(`${def.type} returns exactly "count" placements with finite numbers`, () => {
      for (const n of [1, 2, 7, 100]) {
        const out = def.generate(def.defaults, n, createRng(1));
        expect(out).toHaveLength(n);
        for (const p of out) {
          expect(p.position.every(Number.isFinite)).toBe(true);
          if (p.align) expect(Math.hypot(...p.align)).toBeCloseTo(1, 6);
        }
      }
    });

    it(`${def.type} has a Learn explanation`, () => {
      const ex = def.explain(def.defaults, 20);
      expect(ex.idea.length).toBeGreaterThan(10);
      expect(ex.formulas.length).toBeGreaterThan(0);
      expect(Array.isArray(ex.worked(5))).toBe(true);
    });
  }

  it('circle puts every object exactly on the radius', () => {
    const out = getPattern('circle').generate({ radius: 7, arc: 360, startAngle: 0 }, 12, createRng(1));
    for (const p of out) expect(len(p.position)).toBeCloseTo(7, 9);
    // evenly spaced: neighbours 30° apart
    const a0 = Math.atan2(out[0].position[2], out[0].position[0]);
    const a1 = Math.atan2(out[1].position[2], out[1].position[0]);
    expect(((a1 - a0) * 180) / Math.PI).toBeCloseTo(30, 9);
  });

  it('a half circle (180° arc) includes both ends', () => {
    const out = getPattern('circle').generate({ radius: 1, arc: 180, startAngle: 0 }, 5, createRng(1));
    expect(out[0].position[0]).toBeCloseTo(1);
    expect(out[4].position[0]).toBeCloseTo(-1);
  });

  it('sphere pattern (Fibonacci sphere) puts every point on the sphere surface', () => {
    const out = getPattern('sphere').generate({ radius: 5, coverage: 'full' }, 300, createRng(1));
    for (const p of out) expect(len(p.position)).toBeCloseTo(5, 9);
    const dome = getPattern('sphere').generate({ radius: 5, coverage: 'dome' }, 100, createRng(1));
    for (const p of dome) expect(p.position[1]).toBeGreaterThanOrEqual(0);
  });

  it('sphere pattern lines objects up to point outwards', () => {
    const [p] = getPattern('sphere').generate({ radius: 5, coverage: 'full' }, 50, createRng(1)).slice(10);
    const q = p.align!;
    const up = new Vector3(0, 1, 0).applyQuaternion({ x: q[0], y: q[1], z: q[2], w: q[3] } as never);
    const n = new Vector3(...p.position).normalize();
    expect(up.distanceTo(n)).toBeLessThan(1e-9);
  });

  it('spiral follows θ = i × step and r grows to the radius', () => {
    const p = { style: 'flat', radius: 20, angleStep: 30, rise: 0, startAngle: 0 };
    const out = getPattern('spiral').generate(p, 100, createRng(1));
    expect(len(out[0].position)).toBeCloseTo(0);
    expect(len(out[99].position)).toBeCloseTo(20);
    // object 3 is at 90°: on the +z axis
    expect(out[3].position[0]).toBeCloseTo(0);
    expect(out[3].position[2]).toBeGreaterThan(0);
  });

  it('helix keeps a fixed radius and climbs', () => {
    const p = { style: 'helix', radius: 4, angleStep: 20, rise: 0.5, startAngle: 0 };
    const out = getPattern('spiral').generate(p, 10, createRng(1));
    for (const [i, pl] of out.entries()) {
      expect(Math.hypot(pl.position[0], pl.position[2])).toBeCloseTo(4);
      expect(pl.position[1]).toBeCloseTo(i * 0.5);
    }
  });

  it('sunflower uses the golden angle', () => {
    expect(GOLDEN_ANGLE_DEG).toBeCloseTo(137.5077, 3);
    const out = getPattern('spiral').generate(
      { style: 'sunflower', radius: 10, rise: 0, startAngle: 0 },
      50,
      createRng(1),
    );
    const a1 = (Math.atan2(out[1].position[2], out[1].position[0]) * 180) / Math.PI;
    expect(a1).toBeCloseTo(137.5077, 3);
  });

  it('grid fills columns, then rows, then layers', () => {
    const out = getPattern('grid').generate({ columns: 3, rows: 2, spacing: 2 }, 7, createRng(1));
    expect(out[0].position).toEqual([-2, 0, -1]);
    expect(out[2].position).toEqual([2, 0, -1]);
    expect(out[3].position).toEqual([-2, 0, 1]);
    expect(out[6].position).toEqual([-2, 2, -1]); // second layer
  });

  it('radial rings hold first × k objects', () => {
    const out = getPattern('radial').generate(
      { firstRing: 6, ringGap: 2, heightStep: 0, centerObject: true },
      1 + 6 + 12,
      createRng(1),
    );
    expect(len(out[0].position)).toBeCloseTo(0);
    for (const p of out.slice(1, 7)) expect(len(p.position)).toBeCloseTo(2);
    for (const p of out.slice(7)) expect(len(p.position)).toBeCloseTo(4);
  });

  it('wave heights stay between -A and +A', () => {
    for (const style of ['lines', 'ripple', 'eggcrate']) {
      const out = getPattern('wave').generate(
        { style, columns: 10, spacing: 1, amplitude: 3, wavelength: 5, phase: 0 },
        100,
        createRng(1),
      );
      for (const p of out) expect(Math.abs(p.position[1])).toBeLessThanOrEqual(3 + 1e-9);
    }
  });

  it('random scatter is repeatable with the same seed and stays inside the area', () => {
    const def = getPattern('random');
    const p = { area: 'box', width: 10, height: 4, depth: 6, radius: 5 };
    const a = def.generate(p, 50, createRng(42));
    const b = def.generate(p, 50, createRng(42));
    const c = def.generate(p, 50, createRng(43));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    for (const pl of a) {
      expect(Math.abs(pl.position[0])).toBeLessThanOrEqual(5);
      expect(Math.abs(pl.position[1])).toBeLessThanOrEqual(2);
      expect(Math.abs(pl.position[2])).toBeLessThanOrEqual(3);
    }
    const ball = def.generate({ ...p, area: 'ball' }, 200, createRng(1));
    for (const pl of ball) expect(len(pl.position)).toBeLessThanOrEqual(5 + 1e-9);
  });
});

describe('layout (variation)', () => {
  it('the spec example makes 100 objects with sizes from 0.5 to 2', () => {
    const layout = layoutPattern(specExampleNode());
    expect(layout.count).toBe(100);
    expect(layout.matrices).toHaveLength(1600);
    expect(layout.sizes[0]).toBeCloseTo(0.5);
    expect(layout.sizes[99]).toBeCloseTo(2);
    // the matrix of the last object really has scale 2
    const m = new Matrix4().fromArray(layout.matrices, 99 * 16);
    const s = new Vector3().setFromMatrixScale(m);
    expect(s.x).toBeCloseTo(2);
  });

  it('size modes', () => {
    const v = { ...defaultVariation(), sizeFrom: 1, sizeTo: 3 };
    expect(sizeAt({ ...v, sizeMode: 'ramp' }, 0.5, 0)).toBeCloseTo(2);
    expect(sizeAt({ ...v, sizeMode: 'random' }, 0.5, 0.25)).toBeCloseTo(1.5);
    expect(sizeAt({ ...v, sizeMode: 'pulse' }, 0, 0)).toBeCloseTo(1);
    expect(sizeAt({ ...v, sizeMode: 'pulse' }, 0.5, 0)).toBeCloseTo(3);
  });

  it('colours: single uses the material, gradient goes from → to', () => {
    const node = createPatternNode(shapeSource('box'), 'grid', 'g');
    node.count = 10;
    node.variation = { ...node.variation, colorMode: 'single' };
    expect(layoutPattern(node).colors).toBeNull();
    node.variation = { ...node.variation, colorMode: 'gradient', colorFrom: '#ff0000', colorTo: '#0000ff' };
    const c = layoutPattern(node).colors!;
    expect([c[0], c[1], c[2]]).toEqual([1, 0, 0]);
    expect([c[27], c[28], c[29]]).toEqual([0, 0, 1]);
  });

  it('caps the number of objects', () => {
    const node = createPatternNode(shapeSource('box'), 'grid', 'g');
    node.count = MAX_OBJECTS + 500;
    expect(layoutPattern(node).count).toBe(MAX_OBJECTS);
  });

  it('changing the size mode does not reshuffle random colours', () => {
    const node = createPatternNode(shapeSource('box'), 'random', 'r');
    node.count = 20;
    node.variation = { ...node.variation, colorMode: 'random' };
    const a = layoutPattern(node).colors;
    node.variation = { ...node.variation, sizeMode: 'random', sizeFrom: 0.5, sizeTo: 2 };
    expect(layoutPattern(node).colors).toEqual(a);
  });
});
