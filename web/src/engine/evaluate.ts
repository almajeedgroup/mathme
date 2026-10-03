import { Color, Matrix4 } from 'three';

import { layoutPattern, MAX_OBJECTS } from './layout';
import { symmetryCopyCount, symmetryMatrices, transformToMatrix } from './three/transforms';
import type { CustomShape, MaterialDef, Project, SceneNode, ShapeDef, SourceRef } from './types';

/** One solid object in the finished scene, with its final (world) placement. */
export interface EvalItem {
  nodeId: string;
  /** e.g. "Spiral of spheres #12" */
  name: string;
  shape: ShapeDef;
  matrix: Matrix4;
  material: MaterialDef;
}

interface Part {
  shape: ShapeDef;
  matrix: Matrix4 | null;
  material: MaterialDef;
}

function partsOf(source: SourceRef, material: MaterialDef, library: CustomShape[]): Part[] {
  if (source.kind === 'shape') return [{ shape: source.shape, matrix: null, material }];
  const custom = library.find((c) => c.id === source.customId);
  if (!custom) return [];
  return custom.parts.map((p) => ({
    shape: p.shape,
    matrix: transformToMatrix(p.transform),
    material: p.material,
  }));
}

export class TooManyObjectsError extends Error {}

/**
 * Turn the project tree (groups, symmetry copies, patterns, custom shapes) into a flat list
 * of objects with world matrices. Used by exports, measurements and "save as custom shape".
 */
export function evaluateScene(
  project: Project,
  opts: { rootIds?: string[]; rootMatrix?: Matrix4; maxItems?: number; includeHidden?: boolean } = {},
): EvalItem[] {
  const { nodes, library } = project;
  const maxItems = opts.maxItems ?? Infinity;
  const byParent = new Map<string | null, SceneNode[]>();
  for (const n of nodes) {
    const list = byParent.get(n.parentId) ?? [];
    list.push(n);
    byParent.set(n.parentId, list);
  }
  const out: EvalItem[] = [];
  const color = new Color();

  const push = (item: EvalItem) => {
    if (out.length >= maxItems) throw new TooManyObjectsError(`More than ${maxItems} objects`);
    out.push(item);
  };

  const visit = (node: SceneNode, parent: Matrix4) => {
    if (!node.visible && !opts.includeHidden) return;
    const local = transformToMatrix(node.transform);
    for (const sym of symmetryMatrices(node.symmetry)) {
      const base = parent.clone().multiply(sym).multiply(local);
      if (node.kind === 'group') {
        for (const child of byParent.get(node.id) ?? []) visit(child, base);
      } else if (node.kind === 'object') {
        for (const part of partsOf(node.source, node.material, library)) {
          const m = part.matrix ? base.clone().multiply(part.matrix) : base;
          push({ nodeId: node.id, name: node.name, shape: part.shape, matrix: m, material: part.material });
        }
      } else {
        const layout = layoutPattern(node);
        const parts = partsOf(node.source, node.material, library);
        const inst = new Matrix4();
        for (let i = 0; i < layout.count; i++) {
          inst.fromArray(layout.matrices, i * 16);
          const instMaterial = (part: Part): MaterialDef =>
            layout.colors
              ? { ...part.material, color: `#${color.fromArray(layout.colors, i * 3).getHexString()}` }
              : part.material;
          for (const part of parts) {
            const m = base.clone().multiply(inst);
            if (part.matrix) m.multiply(part.matrix);
            push({
              nodeId: node.id,
              name: `${node.name} #${i + 1}`,
              shape: part.shape,
              matrix: m,
              material: instMaterial(part),
            });
          }
        }
      }
    }
  };

  const roots = opts.rootIds
    ? opts.rootIds.map((id) => nodes.find((n) => n.id === id)).filter((n): n is SceneNode => Boolean(n))
    : (byParent.get(null) ?? []);
  for (const r of roots) visit(r, opts.rootMatrix ?? new Matrix4());
  return out;
}

/** How many objects the scene draws (without building them). */
export function countObjects(project: Project): number {
  const { nodes, library } = project;
  const partCount = (source: SourceRef) =>
    source.kind === 'shape' ? 1 : (library.find((c) => c.id === source.customId)?.parts.length ?? 0);
  const memo = new Map<string, number>();
  const count = (node: SceneNode): number => {
    if (!node.visible) return 0;
    const cached = memo.get(node.id);
    if (cached !== undefined) return cached;
    let own: number;
    if (node.kind === 'group')
      own = nodes.filter((n) => n.parentId === node.id).reduce((s, c) => s + count(c), 0);
    else if (node.kind === 'object') own = partCount(node.source);
    else own = Math.min(node.count, MAX_OBJECTS) * partCount(node.source);
    const total = own * symmetryCopyCount(node.symmetry);
    memo.set(node.id, total);
    return total;
  };
  return nodes.filter((n) => n.parentId === null).reduce((s, n) => s + count(n), 0);
}
