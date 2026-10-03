import {
  ACESFilmicToneMapping,
  type Box3,
  type Camera,
  Color,
  OrthographicCamera,
  PerspectiveCamera,
  Vector3,
  WebGLRenderer,
} from 'three';

import type { Project } from '../engine/types';
import { viewportBridge } from '../viewport/bridge';
import { buildRenderScene } from './sceneBuilder';

export type ViewName = 'current' | 'front' | 'top' | 'side' | 'iso';

export const VIEW_LABELS: Record<ViewName, string> = {
  current: '3D view',
  front: 'Front view',
  top: 'Top view (plan)',
  side: 'Side view',
  iso: '3D view',
};

function fitOrtho(bounds: Box3, view: 'front' | 'top' | 'side', aspect: number): OrthographicCamera {
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const big = Math.max(size.x, size.y, size.z, 1);
  let w: number, h: number;
  const cam = new OrthographicCamera();
  if (view === 'front') {
    [w, h] = [size.x, size.y];
    cam.position.set(center.x, center.y, center.z + big * 2);
  } else if (view === 'top') {
    [w, h] = [size.x, size.z];
    cam.up.set(0, 0, -1);
    cam.position.set(center.x, center.y + big * 2, center.z);
  } else {
    [w, h] = [size.z, size.y];
    cam.position.set(center.x + big * 2, center.y, center.z);
  }
  w = Math.max(w, 0.1) * 1.15;
  h = Math.max(h, 0.1) * 1.15;
  if (w / h > aspect) h = w / aspect;
  else w = h * aspect;
  cam.left = -w / 2;
  cam.right = w / 2;
  cam.top = h / 2;
  cam.bottom = -h / 2;
  cam.near = 0.01;
  cam.far = big * 10;
  cam.lookAt(center);
  cam.updateProjectionMatrix();
  return cam;
}

function perspectiveCamera(view: 'current' | 'iso', bounds: Box3, aspect: number): PerspectiveCamera {
  const live = viewportBridge.camera;
  if (view === 'current' && live instanceof PerspectiveCamera) {
    const cam = live.clone();
    cam.aspect = aspect;
    cam.updateProjectionMatrix();
    return cam;
  }
  const cam = new PerspectiveCamera(40, aspect, 0.01, 10000);
  const center = bounds.getCenter(new Vector3());
  const radius = Math.max(bounds.getSize(new Vector3()).length() / 2, 1);
  const dist = (radius / Math.sin((20 * Math.PI) / 180)) * 1.05;
  cam.position.copy(center).add(new Vector3(1, 0.8, 1).normalize().multiplyScalar(dist));
  cam.near = dist / 100;
  cam.far = dist * 10;
  cam.lookAt(center);
  cam.updateProjectionMatrix();
  return cam;
}

export function cameraFor(view: ViewName, bounds: Box3, aspect: number): Camera {
  return view === 'current' || view === 'iso'
    ? perspectiveCamera(view, bounds, aspect)
    : fitOrtho(bounds, view, aspect);
}

export interface ImageRequest {
  view: ViewName;
  width: number;
  height: number;
}

/** Render pictures of the project without disturbing the live 3D view. */
export async function renderImages(
  project: Project,
  requests: ImageRequest[],
  opts: { transparent?: boolean; type?: 'image/png' | 'image/jpeg' } = {},
): Promise<{ blobs: Blob[]; bounds: Box3 }> {
  const built = buildRenderScene(project);
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.setPixelRatio(1);
  const max = renderer.capabilities.maxTextureSize;
  const background = new Color(project.background);
  built.scene.background = opts.transparent ? null : background;
  renderer.setClearColor(background, opts.transparent ? 0 : 1);
  try {
    const out: Blob[] = [];
    for (const req of requests) {
      const w = Math.min(req.width, max);
      const h = Math.min(req.height, max);
      renderer.setSize(w, h, false);
      renderer.render(built.scene, cameraFor(req.view, built.bounds, w / h));
      const type = opts.type ?? 'image/png';
      const blob = await new Promise<Blob | null>((resolve) =>
        renderer.domElement.toBlob(resolve, type, type === 'image/jpeg' ? 0.9 : undefined),
      );
      if (!blob) throw new Error('The picture could not be made.');
      out.push(blob);
    }
    return { blobs: out, bounds: built.bounds };
  } finally {
    renderer.dispose();
    renderer.forceContextLoss();
    built.dispose();
  }
}

export async function renderPng(
  project: Project,
  width: number,
  height: number,
  transparent: boolean,
): Promise<Blob> {
  const { blobs } = await renderImages(project, [{ view: 'current', width, height }], { transparent });
  return blobs[0];
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
