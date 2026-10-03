import { useEffect, useMemo } from 'react';
import type { BufferGeometry } from 'three';

import { buildGeometry, shapeKey } from '../engine/shapes/registry';
import type { ShapeDef, StoredMesh } from '../engine/types';

/** Build (and later clean up) the triangle mesh for a shape. */
export function useShapeGeometry(shape: ShapeDef, meshes: StoredMesh[]): BufferGeometry {
  const key = shapeKey(shape);
  const meshKey = shape.type === 'mesh' ? meshes : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geometry = useMemo(() => buildGeometry(shape, { meshes }), [key, meshKey]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}
