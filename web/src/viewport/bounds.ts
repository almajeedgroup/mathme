import { Box3, InstancedMesh, Mesh, type Object3D } from 'three';

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
