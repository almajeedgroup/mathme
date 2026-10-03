import { describe, expect, it } from 'vitest';
import { Matrix4 } from 'three';

import { createObjectNode, emptyProject, shapeSource, starterProject } from '../src/engine/project/defaults';
import { buildGeometry } from '../src/engine/shapes/registry';
import { measureGeometry } from '../src/engine/shapes/measure';
import { describeNode } from '../src/export/describe';
import { pdfSafe } from '../src/export/pdf';
import {
  bakeGeometry,
  buildModelScene,
  buildRenderScene,
  ExportTooBigError,
} from '../src/export/sceneBuilder';
import { slugify } from '../src/export/download';

describe('export helpers', () => {
  it('mirrored copies keep their faces pointing outwards after baking', () => {
    const g = buildGeometry({ type: 'box', params: { width: 2, height: 2, depth: 2 } });
    const mirrored = bakeGeometry(g, new Matrix4().makeScale(-1, 1, 1));
    expect(measureGeometry(mirrored).signedVolume).toBeCloseTo(8);
    const nonIndexed = bakeGeometry(g.toNonIndexed(), new Matrix4().makeScale(1, 1, -2));
    expect(measureGeometry(nonIndexed).signedVolume).toBeCloseTo(16);
  });

  it('model scenes have one mesh per object, or one per pattern when merged', () => {
    const p = starterProject();
    const separate = buildModelScene(p, { mode: 'separate', scale: 0.01 });
    let meshes = 0;
    separate.scene.traverse((o) => void ((o as { isMesh?: boolean }).isMesh && meshes++));
    expect(meshes).toBe(100);
    separate.dispose();

    const merged = buildModelScene(p, { mode: 'merged', scale: 1 });
    meshes = 0;
    merged.scene.traverse((o) => void ((o as { isMesh?: boolean }).isMesh && meshes++));
    expect(meshes).toBe(1);
    merged.dispose();
  });

  it('render scenes group objects into instanced meshes and know their size', () => {
    const r = buildRenderScene(starterProject());
    expect(r.count).toBe(100);
    expect(r.bounds.isEmpty()).toBe(false);
    r.dispose();
  });

  it('refuses exports that are far too big', () => {
    const p = emptyProject();
    const n = createObjectNode(shapeSource('sphere'), 'big');
    if (n.source.kind === 'shape') n.source.shape.params.smoothness = 128;
    n.symmetry.radialCopies = 24;
    for (let i = 0; i < 6; i++) p.nodes.push({ ...structuredClone(n), id: `n${i}` });
    expect(() => buildModelScene(p, { mode: 'separate', scale: 1, bakeToWorld: true })).toThrow(
      ExportTooBigError,
    );
  });

  it('PDF text has no characters the PDF font cannot draw', () => {
    expect(pdfSafe('V = ⅓ × π × r² … θ ≈ √2 🌀')).toBe('V = 1/3 × pi × r² ... theta ~ sqrt2 ');
  });

  it('describes how each node was made', () => {
    const p = starterProject();
    const d = describeNode(p.nodes[0], p);
    expect(d.lines.join(' ')).toContain('Pattern: Spiral, 100 objects');
    expect(d.lines.join(' ')).toContain('sizes grow from 0.5× and 2×');
  });

  it('file names are safe', () => {
    expect(slugify('My 3D artwork!')).toBe('my-3d-artwork');
    expect(slugify('Möbius strip')).toBe('mobius-strip');
    expect(slugify('***')).toBe('mathme-artwork');
  });
});
