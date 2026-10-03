import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';

import type { Project } from '../engine/types';
import { buildModelScene, type ModelMode, UNIT_TO_METERS, UNIT_TO_MM } from './sceneBuilder';

/** GLB (binary glTF) in metres, the standard for 3D apps, games and the web. */
export async function exportGlb(project: Project, mode: ModelMode): Promise<Blob> {
  const built = buildModelScene(project, { mode, scale: UNIT_TO_METERS[project.units] });
  try {
    const result = await new GLTFExporter().parseAsync(built.scene, { binary: true });
    return new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' });
  } finally {
    built.dispose();
  }
}

/** Binary STL in millimetres, the format 3D printers (slicers) expect. */
export function exportStl(project: Project): Blob {
  const built = buildModelScene(project, {
    mode: 'separate',
    scale: UNIT_TO_MM[project.units],
    bakeToWorld: true,
  });
  try {
    const view = new STLExporter().parse(built.scene, { binary: true }) as DataView;
    return new Blob([view.buffer as ArrayBuffer], { type: 'model/stl' });
  } finally {
    built.dispose();
  }
}

/** OBJ text file, in the project's own units, one named object per shape. */
export function exportObj(project: Project): Blob {
  const built = buildModelScene(project, { mode: 'separate', scale: 1, bakeToWorld: true });
  try {
    const text = `# Made with MathMe 3D Studio. Units: ${project.units}\n${new OBJExporter().parse(built.scene)}`;
    return new Blob([text], { type: 'model/obj' });
  } finally {
    built.dispose();
  }
}
