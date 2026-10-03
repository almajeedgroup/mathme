/**
 * Triangle data for big library meshes that are loaded from a file at run time instead of being
 * stored inside the project (see StoredMesh.src). Filled by services/modelAssets.ts.
 */
export interface MeshData {
  positions: Float32Array;
  indices: Uint32Array;
}

const assets = new Map<string, MeshData>();

export function registerMeshData(id: string, data: MeshData) {
  assets.set(id, data);
}

export function getMeshData(id: string): MeshData | undefined {
  return assets.get(id);
}

export function hasMeshData(id: string): boolean {
  return assets.has(id);
}
