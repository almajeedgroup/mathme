import { BufferAttribute, BufferGeometry, Mesh } from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import type { Project } from '../engine/types';
import { buildModelScene } from './sceneBuilder';

/**
 * A GLB for the geometry service: every object is its own mesh, already moved into place
 * (world coordinates) and in the project's units.
 */
export async function serviceGlb(project: Project, rootIds?: string[]): Promise<Blob> {
  const built = buildModelScene(project, { mode: 'separate', scale: 1, bakeToWorld: true, rootIds });
  try {
    if (built.count === 0) throw new Error('There is nothing to send.');
    const result = await new GLTFExporter().parseAsync(built.scene, { binary: true });
    return new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' });
  } finally {
    built.dispose();
  }
}

/** Read the service's answer (a GLB) into one triangle mesh. */
export async function glbToTriangles(
  buffer: ArrayBuffer,
): Promise<{ positions: Float32Array; indices: Uint32Array }> {
  const gltf = await new GLTFLoader().parseAsync(buffer, '');
  gltf.scene.updateMatrixWorld(true);
  const pieces: BufferGeometry[] = [];
  gltf.scene.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const src = o.geometry as BufferGeometry;
    const g = new BufferGeometry();
    g.setAttribute('position', src.getAttribute('position').clone());
    const count = g.getAttribute('position').count;
    g.setIndex(
      src.index
        ? src.index.clone()
        : new BufferAttribute(
            Uint32Array.from({ length: count }, (_, i) => i),
            1,
          ),
    );
    g.applyMatrix4(o.matrixWorld);
    pieces.push(g);
  });
  if (!pieces.length) throw new Error('The result has no triangles.');
  const merged = pieces.length === 1 ? pieces[0] : mergeGeometries(pieces, false);
  if (!merged) throw new Error('The result could not be read.');
  return {
    positions: Float32Array.from(merged.getAttribute('position').array as ArrayLike<number>),
    indices: Uint32Array.from(merged.index!.array as ArrayLike<number>),
  };
}
