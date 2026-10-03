import { describe, expect, it } from 'vitest';

import { countObjects, evaluateScene } from '../src/engine/evaluate';
import { migrateProject, parseProjectJson } from '../src/engine/project/migrate';
import { PRESETS } from '../src/engine/project/presets';
import { projectSchema } from '../src/engine/project/schema';
import { starterProject } from '../src/engine/project/defaults';

describe('ideas (presets)', () => {
  for (const preset of PRESETS) {
    it(`${preset.title} is a valid project with objects`, () => {
      const p = preset.build();
      expect(projectSchema.safeParse(p).success).toBe(true);
      const n = countObjects(p);
      expect(n).toBeGreaterThan(0);
      expect(evaluateScene(p)).toHaveLength(n);
      // fresh ids every time
      expect(preset.build().nodes[0].id).not.toBe(p.nodes[0].id);
    });
  }

  it('the brief example preset has 100 objects', () => {
    expect(countObjects(PRESETS.find((p) => p.id === 'spec')!.build())).toBe(100);
  });
});

describe('opening project files', () => {
  it('opens a saved project', () => {
    const p = starterProject();
    const r = parseProjectJson(JSON.stringify(p));
    expect(r.ok && r.project).toEqual(p);
  });

  it('explains what is wrong with bad files', () => {
    const notJson = parseProjectJson('{oops');
    expect(notJson.ok).toBe(false);
    const other = migrateProject({ hello: 1 });
    expect(!other.ok && other.error).toContain('not a MathMe project');
    const newer = migrateProject({ ...starterProject(), version: 99 });
    expect(!newer.ok && newer.error).toContain('newer version');
    const broken = migrateProject({ ...starterProject(), units: 'parsecs' });
    expect(!broken.ok && broken.error).toContain('units');
  });
});

describe('atom preset', () => {
  it('has three different orbit planes', async () => {
    const { Vector3 } = await import('three');
    const atom = PRESETS.find((p) => p.id === 'atom')!.build();
    const rings = evaluateScene(atom).filter((it) => it.shape.type === 'torus');
    const normals = rings.map((r) => new Vector3(0, 1, 0).transformDirection(r.matrix));
    expect(normals).toHaveLength(3);
    expect(Math.abs(normals[0].dot(normals[1]))).toBeLessThan(0.99);
    expect(Math.abs(normals[1].dot(normals[2]))).toBeLessThan(0.99);
  });
});
