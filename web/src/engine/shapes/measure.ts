import { BufferGeometry, Vector3 } from 'three';

export interface MeshMeasurement {
  /** Volume enclosed by the mesh (meaningless for open sheets). */
  volume: number;
  /** Positive when the triangles face outwards. */
  signedVolume: number;
  area: number;
  triangles: number;
}

const a = new Vector3();
const b = new Vector3();
const c = new Vector3();
const ab = new Vector3();
const ac = new Vector3();

/**
 * Measure any triangle mesh. Volume uses the divergence theorem: every triangle makes a
 * little pyramid with the origin, and adding their signed volumes gives the enclosed volume.
 */
export function measureGeometry(geometry: BufferGeometry): MeshMeasurement {
  const pos = geometry.getAttribute('position');
  if (!pos) return { volume: 0, signedVolume: 0, area: 0, triangles: 0 };
  const index = geometry.getIndex();
  const triCount = index ? index.count / 3 : pos.count / 3;
  let volume = 0;
  let area = 0;
  for (let t = 0; t < triCount; t++) {
    const i0 = index ? index.getX(t * 3) : t * 3;
    const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1);
    c.fromBufferAttribute(pos, i2);
    volume += a.dot(ab.crossVectors(b, c)) / 6;
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    area += ab.cross(ac).length() / 2;
  }
  return { volume: Math.abs(volume), signedVolume: volume, area, triangles: triCount };
}
