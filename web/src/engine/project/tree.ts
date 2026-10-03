import { Matrix4, Quaternion, Vector3, Euler } from 'three';

import { radToDeg, uid } from '../math';
import { transformToMatrix } from '../three/transforms';
import type { SceneNode, Transform } from '../types';

/** Helpers for the flat node list (each node points at its parent with parentId). */

export function childrenOf(nodes: SceneNode[], parentId: string | null): SceneNode[] {
  return nodes.filter((n) => n.parentId === parentId);
}

export function descendantIds(nodes: SceneNode[], id: string): string[] {
  const out: string[] = [];
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const n of nodes) {
      if (n.parentId === cur) {
        out.push(n.id);
        stack.push(n.id);
      }
    }
  }
  return out;
}

/** Remove ids whose ancestor is also in the list (so a group and its child aren't both handled). */
export function topLevelOnly(nodes: SceneNode[], ids: string[]): string[] {
  const set = new Set(ids);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return ids.filter((id) => {
    let p = byId.get(id)?.parentId ?? null;
    while (p) {
      if (set.has(p)) return false;
      p = byId.get(p)?.parentId ?? null;
    }
    return true;
  });
}

export function matrixToTransform(m: Matrix4): Transform {
  const p = new Vector3();
  const q = new Quaternion();
  const s = new Vector3();
  m.decompose(p, q, s);
  const e = new Euler().setFromQuaternion(q, 'XYZ');
  const r = (v: number) => Number(v.toFixed(6));
  return {
    position: [r(p.x), r(p.y), r(p.z)],
    rotation: [r(radToDeg(e.x)), r(radToDeg(e.y)), r(radToDeg(e.z))],
    scale: [r(s.x), r(s.y), r(s.z)],
  };
}

/** Combine a parent transform with a child transform (used when ungrouping). */
export function composeTransforms(parent: Transform, child: Transform): Transform {
  return matrixToTransform(transformToMatrix(parent).multiply(transformToMatrix(child)));
}

/** Deep-copy a node and everything inside it, with fresh ids. */
export function cloneSubtree(nodes: SceneNode[], id: string): SceneNode[] {
  const idMap = new Map<string, string>();
  const ids = [id, ...descendantIds(nodes, id)];
  for (const old of ids) idMap.set(old, uid(old.split('_')[0] || 'node'));
  return ids.map((old) => {
    const src = nodes.find((n) => n.id === old)!;
    const copy = structuredClone(src);
    copy.id = idMap.get(old)!;
    copy.parentId = old === id ? src.parentId : (idMap.get(src.parentId ?? '') ?? null);
    return copy;
  });
}
