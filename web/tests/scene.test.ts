import { beforeEach, describe, expect, it } from 'vitest';
import { Vector3 } from 'three';

import { countObjects, evaluateScene } from '../src/engine/evaluate';
import {
  createObjectNode,
  createPatternNode,
  emptyProject,
  shapeSource,
  starterProject,
} from '../src/engine/project/defaults';
import { projectSchema } from '../src/engine/project/schema';
import { symmetryCopyCount, symmetryMatrices } from '../src/engine/three/transforms';
import type { Project } from '../src/engine/types';
import { useProjectStore } from '../src/state/projectStore';
import { useUiStore } from '../src/state/uiStore';
import { saveAsCustomShape } from '../src/ui/actions';

const worldPositions = (project: Project) =>
  evaluateScene(project).map((it) =>
    new Vector3()
      .setFromMatrixPosition(it.matrix)
      .toArray()
      .map((v) => Number(v.toFixed(6))),
  );

describe('project file', () => {
  it('round-trips through JSON and the schema', () => {
    const p = starterProject();
    expect(projectSchema.parse(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });

  it('rejects broken files', () => {
    expect(projectSchema.safeParse({ app: 'something-else' }).success).toBe(false);
    const p = starterProject() as unknown as { nodes: { count: number }[] };
    p.nodes[0].count = -5;
    expect(projectSchema.safeParse(p).success).toBe(false);
  });
});

describe('symmetry', () => {
  it('counts copies: mirrors double, radial multiplies', () => {
    expect(symmetryCopyCount({ mirrorX: false, mirrorY: false, mirrorZ: false, radialCopies: 1 })).toBe(1);
    expect(symmetryCopyCount({ mirrorX: true, mirrorY: true, mirrorZ: false, radialCopies: 6 })).toBe(24);
    expect(symmetryMatrices({ mirrorX: true, mirrorY: false, mirrorZ: true, radialCopies: 3 })).toHaveLength(
      12,
    );
  });

  it('mirror X flips the position across the YZ plane', () => {
    const p = emptyProject();
    const n = createObjectNode(shapeSource('box'), 'b');
    n.transform.position = [5, 1, 2];
    n.symmetry.mirrorX = true;
    p.nodes.push(n);
    expect(worldPositions(p)).toEqual([
      [5, 1, 2],
      [-5, 1, 2],
    ]);
  });

  it('radial copies are spun evenly around Y', () => {
    const p = emptyProject();
    const n = createObjectNode(shapeSource('box'), 'b');
    n.transform.position = [4, 0, 0];
    n.symmetry.radialCopies = 4;
    p.nodes.push(n);
    const pts = worldPositions(p);
    expect(pts).toHaveLength(4);
    for (const pt of pts) expect(Math.hypot(pt[0], pt[2])).toBeCloseTo(4);
  });
});

describe('evaluateScene / countObjects', () => {
  it('agree for patterns inside symmetric groups', () => {
    const store = useProjectStore.getState();
    store.setProject(emptyProject());
    const pat = createPatternNode(shapeSource('sphere'), 'circle', 'ring');
    pat.count = 10;
    const obj = createObjectNode(shapeSource('cone'), 'cone');
    store.addNode(pat);
    store.addNode(obj);
    const g = store.groupNodes([pat.id, obj.id])!;
    store.updateNode(g, (n) => void (n.symmetry.radialCopies = 6));
    const project = useProjectStore.getState().project;
    expect(countObjects(project)).toBe(66);
    expect(evaluateScene(project)).toHaveLength(66);
  });

  it('hidden things are skipped', () => {
    const p = starterProject();
    p.nodes[0].visible = false;
    expect(countObjects(p)).toBe(0);
    expect(evaluateScene(p)).toHaveLength(0);
  });
});

describe('project store', () => {
  beforeEach(() => {
    useProjectStore.getState().setProject(emptyProject());
    useProjectStore.temporal.getState().clear();
    useUiStore.getState().select(null);
  });

  it('grouping and ungrouping keeps everything where it was', () => {
    const store = useProjectStore.getState();
    const a = createObjectNode(shapeSource('box'), 'a');
    a.transform.position = [2, 0, 0];
    const b = createObjectNode(shapeSource('box'), 'b');
    b.transform.position = [6, 2, 0];
    store.addNode(a);
    store.addNode(b);
    const before = worldPositions(useProjectStore.getState().project);
    const g = store.groupNodes([a.id, b.id])!;
    const grouped = useProjectStore.getState().project;
    expect(grouped.nodes.find((n) => n.id === g)!.transform.position).toEqual([4, 1, 0]); // centered
    expect(worldPositions(grouped)).toEqual(before);
    // turn the group, then ungroup: children keep their new world placement
    store.updateNode(g, (n) => void (n.transform.rotation = [0, 90, 0]));
    const turned = worldPositions(useProjectStore.getState().project);
    store.ungroup(g);
    const after = useProjectStore.getState().project;
    expect(after.nodes.every((n) => n.parentId === null)).toBe(true);
    expect(worldPositions(after)).toEqual(turned);
  });

  it('deleting a group deletes what is inside', () => {
    const store = useProjectStore.getState();
    const a = createObjectNode(shapeSource('box'), 'a');
    const b = createObjectNode(shapeSource('box'), 'b');
    store.addNode(a);
    store.addNode(b);
    const g = store.groupNodes([a.id, b.id])!;
    store.removeNodes([g]);
    expect(useProjectStore.getState().project.nodes).toHaveLength(0);
  });

  it('duplicates get new ids and move over a little', () => {
    const store = useProjectStore.getState();
    const a = createObjectNode(shapeSource('box'), 'a');
    store.addNode(a);
    const [copy] = store.duplicateNodes([a.id]);
    const nodes = useProjectStore.getState().project.nodes;
    expect(copy).not.toBe(a.id);
    expect(nodes.find((n) => n.id === copy)!.transform.position[0]).toBe(3);
  });

  it('undo and redo', async () => {
    const store = useProjectStore.getState();
    store.addNode(createObjectNode(shapeSource('box'), 'a'));
    await new Promise((r) => setTimeout(r, 450));
    store.addNode(createObjectNode(shapeSource('box'), 'b'));
    expect(useProjectStore.getState().project.nodes).toHaveLength(2);
    useProjectStore.temporal.getState().undo();
    expect(useProjectStore.getState().project.nodes).toHaveLength(1);
    useProjectStore.temporal.getState().redo();
    expect(useProjectStore.getState().project.nodes).toHaveLength(2);
  });

  it('quick changes (like dragging a slider) are one undo step', async () => {
    const store = useProjectStore.getState();
    const a = createObjectNode(shapeSource('box'), 'a');
    store.addNode(a);
    useProjectStore.temporal.getState().clear();
    await new Promise((r) => setTimeout(r, 450));
    for (let i = 1; i <= 20; i++) store.updateNode(a.id, (n) => void (n.transform.position = [i, 0, 0]));
    useProjectStore.temporal.getState().undo();
    expect(useProjectStore.getState().project.nodes[0].transform.position).toEqual([0, 0, 0]);
  });

  it('saves a group as a custom shape, centered on the group', () => {
    const store = useProjectStore.getState();
    const a = createObjectNode(shapeSource('cone'), 'cone');
    a.transform.position = [10, 0, 0];
    const b = createObjectNode(shapeSource('sphere'), 'ball');
    b.transform.position = [12, 0, 0];
    store.addNode(a);
    store.addNode(b);
    const g = store.groupNodes([a.id, b.id])!;
    expect(saveAsCustomShape(g, 'Snowman')).toEqual({ ok: true });
    const [custom] = useProjectStore.getState().project.library;
    expect(custom.name).toBe('Snowman');
    expect(custom.parts.map((p) => p.transform.position[0])).toEqual([-1, 1]);
    expect(custom.parts.map((p) => p.shape.type)).toEqual(['cone', 'sphere']);
    // a custom shape in use can't be deleted
    store.addNode(createObjectNode({ kind: 'custom', customId: custom.id }, 'snowman'));
    expect(store.removeCustomShape(custom.id)).toBe(false);
  });
});

describe('undo steps', () => {
  it('two quick discrete actions are two undo steps', () => {
    const store = useProjectStore.getState();
    store.setProject(emptyProject());
    useProjectStore.temporal.getState().clear();
    store.addNode(createObjectNode(shapeSource('box'), 'a'));
    store.addNode(createObjectNode(shapeSource('box'), 'b'));
    useProjectStore.temporal.getState().undo();
    expect(useProjectStore.getState().project.nodes).toHaveLength(1);
  });

  it('an edit right after adding something is its own step', () => {
    const store = useProjectStore.getState();
    store.setProject(emptyProject());
    useProjectStore.temporal.getState().clear();
    const a = createObjectNode(shapeSource('box'), 'a');
    store.addNode(a);
    store.updateNode(a.id, (n) => void (n.name = 'renamed'));
    useProjectStore.temporal.getState().undo();
    const nodes = useProjectStore.getState().project.nodes;
    expect(nodes).toHaveLength(1);
    expect(nodes[0].name).toBe('a');
  });
});
