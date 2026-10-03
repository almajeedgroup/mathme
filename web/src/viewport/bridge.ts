import type { Camera, Object3D, WebGLRenderer } from 'three';

/**
 * The live viewport's renderer, camera and content group, so that exports (PNG, PDF)
 * can use the same view the student is looking at.
 */
export const viewportBridge: {
  gl: WebGLRenderer | null;
  camera: Camera | null;
  content: Object3D | null;
  invalidate: (() => void) | null;
} = { gl: null, camera: null, content: null, invalidate: null };
