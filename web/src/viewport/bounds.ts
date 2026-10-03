import { Box3, InstancedMesh, Mesh, type Object3D, Vector3 } from 'three';

/** Bounding box of everything drawn inside an object (handles instanced patterns). */
export function contentBounds(root: Object3D): Box3 {
  const box = new Box3();
  const tmp = new Box3();
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    if (o instanceof InstancedMesh) {
      if (o.count === 0) return;
      o.computeBoundingBox();
      if (o.boundingBox) box.union(tmp.copy(o.boundingBox).applyMatrix4(o.matrixWorld));
    } else if (o instanceof Mesh) {
      const g = o.geometry;
      if (!g.boundingBox) g.computeBoundingBox();
      if (g.boundingBox) box.union(tmp.copy(g.boundingBox).applyMatrix4(o.matrixWorld));
    }
  });
  return box;
}

/**
 * Bounding box of the parts of a model that lie close to a plane (n · x = d), i.e. roughly the
 * cut face. Used to frame the camera on a cross-section. Instanced patterns are skipped.
 */
export function sliceBounds(root: Object3D, normal: Vector3, d: number, thickness: number): Box3 {
  const box = new Box3();
  const v = new Vector3();
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    if (!(o instanceof Mesh) || o instanceof InstancedMesh) return;
    const pos = o.geometry.getAttribute('position');
    if (!pos) return;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (Math.abs(normal.dot(v) - d) < thickness) box.expandByPoint(v);
    }
  });
  return box;
}
