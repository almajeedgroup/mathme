import { describe, expect, it } from 'vitest';

import { SHAPE_LIST, buildGeometry, defaultShape, isOpenShape } from '../src/engine/shapes/registry';
import { measureGeometry } from '../src/engine/shapes/measure';
import { LATHE_PRESETS, OUTLINE_PRESETS } from '../src/engine/shapes/profiles';
import type { ShapeDef } from '../src/engine/types';

function measured(def: ShapeDef) {
  return measureGeometry(buildGeometry(def));
}

describe('shapes', () => {
  for (const shape of SHAPE_LIST.filter((s) => !s.hidden)) {
    it(`${shape.label} builds a mesh with triangles`, () => {
      const g = buildGeometry(defaultShape(shape.type));
      expect(g.getAttribute('position').count).toBeGreaterThan(3);
      expect(g.getAttribute('normal')).toBeTruthy();
      const bb = g.boundingBox!;
      expect(bb.max.x - bb.min.x).toBeGreaterThan(0);
    });
  }

  it('box formula: V = w × h × d, A = 2(wh + wd + hd), and the mesh agrees', () => {
    const def: ShapeDef = { type: 'box', params: { width: 2, height: 3, depth: 4 } };
    const [v, a] = SHAPE_LIST.find((s) => s.type === 'box')!.formulas!(def.params);
    expect(v.value).toBe(24);
    expect(a.value).toBe(52);
    const m = measured(def);
    expect(m.volume).toBeCloseTo(24, 6);
    expect(m.area).toBeCloseTo(52, 6);
  });

  // Curved shapes are made of flat pieces, so the mesh is slightly smaller than the exact formula.
  const close = (shape: ShapeDef, tolerance: number) => {
    const def = SHAPE_LIST.find((s) => s.type === shape.type)!;
    const params = { ...def.defaults, ...shape.params };
    const formulas = def.formulas!(params);
    const vol = formulas.find((f) => f.quantity === 'Volume')!.value;
    const area = formulas.find((f) => f.quantity === 'Surface area')!.value;
    const m = measured({ type: shape.type, params });
    expect(Math.abs(m.volume - vol) / vol).toBeLessThan(tolerance);
    expect(Math.abs(m.area - area) / area).toBeLessThan(tolerance);
  };

  it('sphere formula matches the mesh', () =>
    close({ type: 'sphere', params: { radius: 1.5, smoothness: 128 } }, 0.01));
  it('cylinder formula matches the mesh', () =>
    close({ type: 'cylinder', params: { radiusTop: 1, radiusBottom: 1, height: 3, smoothness: 128 } }, 0.01));
  it('frustum formula matches the mesh', () =>
    close(
      { type: 'cylinder', params: { radiusTop: 0.5, radiusBottom: 1.5, height: 2, smoothness: 128 } },
      0.01,
    ));
  it('cone formula matches the mesh', () =>
    close({ type: 'cone', params: { radius: 1, height: 2, smoothness: 128 } }, 0.01));
  it('torus formula matches the mesh', () =>
    close({ type: 'torus', params: { ringRadius: 2, tube: 0.5, smoothness: 128 } }, 0.01));
  it('pyramid formula matches the mesh', () =>
    close({ type: 'pyramid', params: { base: 2, height: 3 } }, 1e-6));
  it('prism formula matches the mesh', () =>
    close({ type: 'prism', params: { sides: 6, side: 1, height: 2 } }, 1e-6));
  it('capsule formula matches the mesh', () =>
    close({ type: 'capsule', params: { radius: 0.6, length: 1.5, smoothness: 64 } }, 0.02));
  for (const type of ['tetrahedron', 'octahedron', 'dodecahedron', 'icosahedron'] as const) {
    it(`${type} formula matches the mesh`, () => close({ type, params: { radius: 1.3 } }, 1e-6));
  }

  it('extruded outline: V = shoelace area × thickness', () => {
    const square: [number, number][] = [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ];
    const def: ShapeDef = {
      type: 'extrude',
      params: { outline: square, depth: 0.5, bevel: false, bevelSize: 0.1 },
    };
    const f = SHAPE_LIST.find((s) => s.type === 'extrude')!.formulas!(def.params);
    expect(f.find((l) => l.quantity === 'Volume')!.value).toBeCloseTo(2);
    expect(measured(def).volume).toBeCloseTo(2, 6);
    expect(
      measured({ type: 'extrude', params: { outline: OUTLINE_PRESETS[0].points, depth: 1 } }).volume,
    ).toBeGreaterThan(0);
  });

  it('spun (lathe) shapes: closed profiles have outward faces and a frustum-sum volume', () => {
    for (const preset of LATHE_PRESETS) {
      const def: ShapeDef = { type: 'lathe', params: { profile: preset.points, smoothness: 96 } };
      expect(isOpenShape(def)).toBe(false);
      const m = measured(def);
      expect(m.signedVolume).toBeGreaterThan(0);
      const f = SHAPE_LIST.find((s) => s.type === 'lathe')!.formulas!(def.params);
      const v = f.find((l) => l.quantity === 'Volume')!.value;
      expect(Math.abs(m.volume - v) / v).toBeLessThan(0.01);
    }
    // a profile drawn the other way round is fixed automatically
    const reversed: ShapeDef = {
      type: 'lathe',
      params: { profile: [...LATHE_PRESETS[0].points].reverse(), smoothness: 48 },
    };
    expect(measured(reversed).signedVolume).toBeGreaterThan(0);
  });

  it('graph surfaces follow the formula', () => {
    const g = buildGeometry({
      type: 'graphSurface',
      params: { formula: 'x + 2*z', size: 4, heightScale: 1, resolution: 4 },
    });
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) expect(pos.getY(i)).toBeCloseTo(pos.getX(i) + 2 * pos.getZ(i));
    expect(isOpenShape({ type: 'graphSurface', params: {} })).toBe(true);
  });

  it('a bad formula still builds (flat) instead of crashing', () => {
    const g = buildGeometry({
      type: 'graphSurface',
      params: { formula: 'sin(', size: 4, heightScale: 1, resolution: 4 },
    });
    expect(g.getAttribute('position').count).toBeGreaterThan(0);
  });

  it('parametric sphere preset has the right size', () => {
    const g = buildGeometry({
      type: 'parametric',
      params: {
        x: '2 * sin(v) * cos(u)',
        y: '2 * cos(v)',
        z: '2 * sin(v) * sin(u)',
        uMin: '0',
        uMax: '2*pi',
        vMin: '0',
        vMax: 'pi',
        scale: 1,
        resolution: 32,
      },
    });
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++)
      expect(Math.hypot(pos.getX(i), pos.getY(i), pos.getZ(i))).toBeCloseTo(2, 6);
  });

  it('3D text builds letters', () => {
    const g = buildGeometry({
      type: 'text3d',
      params: { text: 'Hi 10!', size: 2, depth: 0.5, bevel: false },
    });
    expect(g.getAttribute('position').count).toBeGreaterThan(50);
  });
});
