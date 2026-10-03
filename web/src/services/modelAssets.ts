import { BufferAttribute, BufferGeometry, Color, Matrix4, Mesh, type Material, type Object3D } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { create } from 'zustand';

import { encodeFloat32, encodeUint32 } from '../engine/binary';
import { hasMeshData, registerMeshData } from '../engine/meshAssets';
import { uid } from '../engine/math';
import { createGroupNode, createObjectNode, defaultMaterial, emptyProject } from '../engine/project/defaults';
import type { CutPreset, Project, StoredMesh, Units, Vec3 } from '../engine/types';

/** Bumped whenever a linked mesh finishes loading, so the 3D view rebuilds it. */
export const useAssetStore = create<{ version: number; bump(): void }>()((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));

export interface ModelPart {
  name: string;
  color: string;
  positions: Float32Array; // already moved into place (world coordinates of the file)
  indices: Uint32Array;
}

function partFromMesh(mesh: Mesh, fallbackName: string): ModelPart | null {
  const src = mesh.geometry as BufferGeometry;
  const pos = src.getAttribute('position');
  if (!pos || pos.count < 3) return null;
  let g = new BufferGeometry();
  g.setAttribute('position', pos.clone());
  if (src.index) g.setIndex(src.index.clone());
  else g = mergeVertices(g, 1e-6); // STL/OBJ files repeat every corner; join them
  mesh.updateWorldMatrix(true, false);
  g.applyMatrix4(mesh.matrixWorld);
  const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as Material & {
    color?: Color;
  };
  const color = material?.color ? `#${material.color.getHexString()}` : '#c8323c';
  const index =
    g.index ??
    new BufferAttribute(
      Uint32Array.from({ length: pos.count }, (_, i) => i),
      1,
    );
  return {
    name: mesh.name || fallbackName,
    color,
    positions: Float32Array.from(g.getAttribute('position').array as ArrayLike<number>),
    indices: Uint32Array.from(index.array as ArrayLike<number>),
  };
}

function partsFromObject(root: Object3D, fileName: string): ModelPart[] {
  root.updateMatrixWorld(true);
  const out: ModelPart[] = [];
  let i = 0;
  root.traverse((o) => {
    if (o instanceof Mesh) {
      const p = partFromMesh(o, `${fileName} part ${++i}`);
      if (p) out.push(p);
    }
  });
  return out;
}

export type ModelFormat = 'glb' | 'gltf' | 'stl' | 'obj';

export async function parseModel(
  buffer: ArrayBuffer,
  format: ModelFormat,
  fileName: string,
): Promise<ModelPart[]> {
  if (format === 'glb' || format === 'gltf') {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().parseAsync(buffer, '');
    return partsFromObject(gltf.scene, fileName);
  }
  if (format === 'stl') {
    const { STLLoader } = await import('three/addons/loaders/STLLoader.js');
    const geometry = new STLLoader().parse(buffer);
    return partsFromObject(new Mesh(geometry), fileName);
  }
  const { OBJLoader } = await import('three/addons/loaders/OBJLoader.js');
  return partsFromObject(new OBJLoader().parse(new TextDecoder().decode(buffer)), fileName);
}

/** How many project units one file unit is. GLB/glTF are metres; STL and OBJ are usually millimetres. */
export function fileUnitScale(format: ModelFormat, units: Units): number {
  const toMetres = format === 'glb' || format === 'gltf' ? 1 : 0.001;
  const unitInMetres = { mm: 0.001, cm: 0.01, m: 1 }[units];
  return toMetres / unitInMetres;
}

function boundsOf(parts: ModelPart[]): { min: Vec3; max: Vec3 } {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of parts) {
    for (let i = 0; i < p.positions.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        const v = p.positions[i + k];
        if (v < min[k]) min[k] = v;
        if (v > max[k]) max[k] = v;
      }
    }
  }
  return { min, max };
}

function transformed(p: ModelPart, scale: number, offset: Vec3): Float32Array {
  const m = new Matrix4().makeScale(scale, scale, scale).setPosition(...offset);
  const g = new BufferGeometry().setAttribute('position', new BufferAttribute(p.positions.slice(), 3));
  g.applyMatrix4(m);
  return g.getAttribute('position').array as Float32Array;
}

/**
 * Turn an imported file into a group of shapes in the project. The model is scaled to the
 * project's units, centred and stood on the floor. Its triangles are stored inside the project.
 */
export function modelToNodes(parts: ModelPart[], name: string, format: ModelFormat, units: Units) {
  const scale = fileUnitScale(format, units);
  const { min, max } = boundsOf(parts);
  const offset: Vec3 = [-((min[0] + max[0]) / 2) * scale, -min[1] * scale, -((min[2] + max[2]) / 2) * scale];
  const group = createGroupNode(name);
  const meshes: StoredMesh[] = [];
  const nodes = parts.map((p) => {
    const id = uid('mesh');
    meshes.push({
      id,
      name: p.name,
      positions: encodeFloat32(transformed(p, scale, offset)),
      indices: encodeUint32(p.indices),
    });
    const node = createObjectNode(
      { kind: 'shape', shape: { type: 'mesh', params: { meshId: id } } },
      p.name,
      p.color,
    );
    node.parentId = group.id;
    return node;
  });
  return { group, nodes, meshes };
}

/** Load the triangles of every linked mesh (StoredMesh.src) that isn't loaded yet. */
export async function ensureLinkedMeshes(project: Project): Promise<void> {
  const missing = project.meshes.filter((m) => m.src && !hasMeshData(m.id));
  if (!missing.length) return;
  const byUrl = new Map<string, StoredMesh[]>();
  for (const m of missing) byUrl.set(m.src!.url, [...(byUrl.get(m.src!.url) ?? []), m]);
  for (const [url, list] of byUrl) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not load ${url} (${res.status}).`);
    const parts = await parseModel(await res.arrayBuffer(), 'glb', url);
    for (const m of list) {
      const part = parts.find((p) => p.name === m.src!.node);
      if (part)
        registerMeshData(m.id, {
          positions: transformed(part, m.src!.scale, m.src!.offset),
          indices: part.indices,
        });
    }
  }
  useAssetStore.getState().bump();
}

export const HEART_URL = './models/heart.glb';
export const HEART_VIEWS_URL = './models/heart-views.json';

interface HeartViews {
  units: 'mm';
  core_centre_mm: Vec3;
  views: { id: string; name: string; group: string; point: Vec3; normal: Vec3 }[];
}

/** A new project with the real HRA heart (linked, not copied) and its standard cutting planes. */
export async function buildHeartProject(): Promise<Project> {
  const [glbRes, viewsRes] = await Promise.all([fetch(HEART_URL), fetch(HEART_VIEWS_URL)]);
  if (!glbRes.ok || !viewsRes.ok) throw new Error('The heart model could not be downloaded.');
  const views = (await viewsRes.json()) as HeartViews;
  const parts = await parseModel(await glbRes.arrayBuffer(), 'glb', 'heart');
  const scale = 100; // the file is in metres; the project is in centimetres
  const c = views.core_centre_mm.map((v) => v / 10) as Vec3; // centre of the heart in cm
  const offset: Vec3 = [-c[0], -c[1] + 7, -c[2]];
  const project = emptyProject('Human heart (HRA)');
  project.background = '#eef0f4';
  const group = createGroupNode('Human heart (HRA reference)');
  project.nodes.push(group);
  for (const p of parts) {
    const id = uid('mesh');
    project.meshes.push({
      id,
      name: p.name,
      positions: '',
      indices: '',
      src: { url: HEART_URL, node: p.name, scale, offset },
    });
    registerMeshData(id, { positions: transformed(p, scale, offset), indices: p.indices });
    const node = createObjectNode(
      { kind: 'shape', shape: { type: 'mesh', params: { meshId: id } } },
      p.name,
      p.color,
    );
    node.material = { ...defaultMaterial(p.color), roughness: 0.55, metalness: 0 };
    node.parentId = group.id;
    project.nodes.push(node);
  }
  project.cutPresets = views.views.map<CutPreset>((v) => ({
    id: v.id,
    name: v.name,
    normal: v.normal,
    point: [v.point[0] / 10 + offset[0], v.point[1] / 10 + offset[1], v.point[2] / 10 + offset[2]],
  }));
  useAssetStore.getState().bump();
  return project;
}
