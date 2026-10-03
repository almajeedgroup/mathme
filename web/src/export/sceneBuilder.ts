import {
  AmbientLight,
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  FrontSide,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Scene,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { evaluateScene, type EvalItem } from '../engine/evaluate';
import { buildGeometry, isOpenShape, shapeKey } from '../engine/shapes/registry';
import type { MaterialDef, Project, Units } from '../engine/types';
import { contentBounds } from '../viewport/bounds';

export const UNIT_TO_METERS: Record<Units, number> = { mm: 0.001, cm: 0.01, m: 1 };
export const UNIT_TO_MM: Record<Units, number> = { mm: 1, cm: 10, m: 1000 };

/** The most triangles we will put in an STL/OBJ/print file (about 100 MB of STL). */
export const MAX_EXPORT_TRIANGLES = 2_000_000;

export class ExportTooBigError extends Error {}

export interface BuiltScene {
  scene: Scene;
  /** How many objects were exported. */
  count: number;
  dispose(): void;
}

/** Builds each shape's mesh once and shares it between all the objects that use it. */
class GeometryCache {
  private map = new Map<string, BufferGeometry>();
  constructor(private project: Project) {}
  get(item: EvalItem): BufferGeometry {
    const key = shapeKey(item.shape);
    let g = this.map.get(key);
    if (!g) {
      g = buildGeometry(item.shape, { meshes: this.project.meshes });
      this.map.set(key, g);
    }
    return g;
  }
  triangles(item: EvalItem): number {
    const g = this.get(item);
    return (g.index ? g.index.count : g.getAttribute('position').count) / 3;
  }
  dispose() {
    for (const g of this.map.values()) g.dispose();
  }
}

class MaterialCache {
  private map = new Map<string, MeshStandardMaterial>();
  get(
    def: MaterialDef,
    open: boolean,
    opts: { white?: boolean; vertexColors?: boolean; doubleSided?: boolean } = {},
  ) {
    const key = JSON.stringify([def, open, opts]);
    let m = this.map.get(key);
    if (!m) {
      m = new MeshStandardMaterial({
        name: `Material ${this.map.size + 1}`,
        color: opts.white || opts.vertexColors ? 0xffffff : new Color(def.color),
        metalness: def.metalness,
        roughness: def.roughness,
        transparent: def.opacity < 1,
        opacity: def.opacity,
        flatShading: def.flatShading,
        side: open || opts.doubleSided ? DoubleSide : FrontSide,
        vertexColors: Boolean(opts.vertexColors),
      });
      this.map.set(key, m);
    }
    return m;
  }
  dispose() {
    for (const m of this.map.values()) m.dispose();
  }
}

/** The same lights as the 3D view, so pictures look the same. */
export function addViewportLights(scene: Scene) {
  scene.add(new HemisphereLight('#ffffff', '#9aa5b1', 1.1));
  const key = new DirectionalLight('#ffffff', 2.2);
  key.position.set(30, 50, 25);
  const fill = new DirectionalLight('#ffffff', 0.7);
  fill.position.set(-30, 20, -20);
  scene.add(key, fill, new AmbientLight('#ffffff', 0.25));
}

/** Fast scene for pictures: one instanced mesh per kind of object. */
export function buildRenderScene(project: Project): BuiltScene & { bounds: Box3 } {
  const items = evaluateScene(project);
  const geometries = new GeometryCache(project);
  const materials = new MaterialCache();
  const scene = new Scene();
  const content = new Group();
  scene.add(content);
  const groups = new Map<string, EvalItem[]>();
  for (const it of items) {
    const { color: _color, ...rest } = it.material;
    const key = `${shapeKey(it.shape)}|${JSON.stringify(rest)}`;
    groups.set(key, [...(groups.get(key) ?? []), it]);
  }
  const c = new Color();
  for (const list of groups.values()) {
    const first = list[0];
    // double-sided: mirrored copies are drawn inside-out otherwise
    const mesh = new InstancedMesh(
      geometries.get(first),
      materials.get(first.material, isOpenShape(first.shape), { white: true, doubleSided: true }),
      list.length,
    );
    list.forEach((it, i) => {
      mesh.setMatrixAt(i, it.matrix);
      mesh.setColorAt(i, c.set(it.material.color));
    });
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    content.add(mesh);
  }
  addViewportLights(scene);
  return {
    scene,
    count: items.length,
    bounds: contentBounds(content),
    dispose: () => {
      geometries.dispose();
      materials.dispose();
    },
  };
}

/**
 * Copy a shape's mesh into world space. Mirror copies turn the triangles inside out, so
 * their corner order is swapped back (3D printers care about which side is outside).
 */
export function bakeGeometry(
  source: BufferGeometry,
  matrix: Matrix4,
  keep: string[] = ['position', 'normal'],
): BufferGeometry {
  const g = new BufferGeometry();
  for (const name of keep) {
    const attr = source.getAttribute(name);
    if (attr) g.setAttribute(name, attr.clone());
  }
  if (source.index) g.setIndex(source.index.clone());
  g.applyMatrix4(matrix);
  if (matrix.determinant() < 0) flipWinding(g);
  return g;
}

function flipWinding(g: BufferGeometry) {
  const index = g.index;
  if (index) {
    const a = index.array;
    for (let i = 0; i < a.length; i += 3) {
      const t = a[i + 1];
      a[i + 1] = a[i + 2];
      a[i + 2] = t;
    }
    index.needsUpdate = true;
    return;
  }
  for (const attr of Object.values(g.attributes) as BufferAttribute[]) {
    const n = attr.itemSize;
    const arr = attr.array;
    for (let v = 0; v + 2 < attr.count; v += 3) {
      for (let k = 0; k < n; k++) {
        const i1 = (v + 1) * n + k;
        const i2 = (v + 2) * n + k;
        const t = arr[i1];
        arr[i1] = arr[i2];
        arr[i2] = t;
      }
    }
    attr.needsUpdate = true;
  }
}

function checkTriangles(items: EvalItem[], geometries: GeometryCache) {
  let total = 0;
  for (const it of items) total += geometries.triangles(it);
  if (total > MAX_EXPORT_TRIANGLES)
    throw new ExportTooBigError(
      `That is ${(total / 1e6).toFixed(1)} million triangles, which is too big to export. Use fewer objects or lower the Smoothness.`,
    );
  return total;
}

export type ModelMode = 'separate' | 'merged';

/**
 * Scene for 3D files.
 * - separate: every object is its own named mesh (easy to edit in other apps)
 * - merged: one mesh per pattern with colours stored on the corners (small and fast)
 * - world: like separate but already moved into place (for STL/OBJ, which ignore node positions)
 */
export function buildModelScene(
  project: Project,
  opts: { mode: ModelMode; scale: number; bakeToWorld?: boolean; rootIds?: string[] },
): BuiltScene {
  const items = evaluateScene(project, { rootIds: opts.rootIds });
  const geometries = new GeometryCache(project);
  const materials = new MaterialCache();
  const owned: BufferGeometry[] = [];
  const scene = new Scene();
  const root = new Group();
  root.name = project.name || 'MathMe artwork';
  scene.add(root);
  const scaleMatrix = new Matrix4().makeScale(opts.scale, opts.scale, opts.scale);
  if (opts.mode === 'merged' || opts.bakeToWorld) checkTriangles(items, geometries);

  const byNode = new Map<string, EvalItem[]>();
  for (const it of items) byNode.set(it.nodeId, [...(byNode.get(it.nodeId) ?? []), it]);
  const nodeName = (id: string) => project.nodes.find((n) => n.id === id)?.name ?? 'Object';

  for (const [nodeId, list] of byNode) {
    const group = new Group();
    group.name = nodeName(nodeId);
    root.add(group);
    if (opts.mode === 'separate') {
      for (const it of list) {
        const open = isOpenShape(it.shape);
        let mesh: Mesh;
        if (opts.bakeToWorld) {
          const g = bakeGeometry(geometries.get(it), scaleMatrix.clone().multiply(it.matrix));
          owned.push(g);
          mesh = new Mesh(g, materials.get(it.material, open));
        } else {
          mesh = new Mesh(geometries.get(it), materials.get(it.material, open));
          mesh.matrixAutoUpdate = false;
          mesh.matrix.copy(it.matrix);
        }
        mesh.name = it.name;
        group.add(mesh);
      }
      continue;
    }
    // merged: one mesh per shape used by this node
    const byShape = new Map<string, EvalItem[]>();
    for (const it of list) byShape.set(shapeKey(it.shape), [...(byShape.get(shapeKey(it.shape)) ?? []), it]);
    for (const part of byShape.values()) {
      const c = new Color();
      const pieces = part.map((it) => {
        const g = bakeGeometry(geometries.get(it), scaleMatrix.clone().multiply(it.matrix));
        c.set(it.material.color);
        const colors = new Float32Array(g.getAttribute('position').count * 3);
        for (let i = 0; i < colors.length; i += 3) colors.set([c.r, c.g, c.b], i);
        g.setAttribute('color', new BufferAttribute(colors, 3));
        return g;
      });
      const merged = mergeGeometries(pieces, false);
      pieces.forEach((g) => g.dispose());
      if (!merged) continue;
      owned.push(merged);
      const mesh = new Mesh(
        merged,
        materials.get(part[0].material, isOpenShape(part[0].shape), { vertexColors: true }),
      );
      mesh.name = `${group.name} (${part.length})`;
      group.add(mesh);
    }
  }
  if (opts.mode === 'separate' && !opts.bakeToWorld) root.scale.setScalar(opts.scale);
  scene.updateMatrixWorld(true);
  return {
    scene,
    count: items.length,
    dispose: () => {
      geometries.dispose();
      materials.dispose();
      owned.forEach((g) => g.dispose());
    },
  };
}
