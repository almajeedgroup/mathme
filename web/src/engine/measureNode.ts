import { layoutPattern } from './layout';
import { measureShape, type ShapeMeasurement } from './measureShape';
import { symmetryCopyCount } from './three/transforms';
import type { ObjectNode, PatternNode, Project, SourceRef } from './types';

/** Measure one copy of whatever a node draws (a shape, or all parts of a custom shape). */
export function measureSource(source: SourceRef, project: Project): ShapeMeasurement | null {
  const ctx = { meshes: project.meshes };
  if (source.kind === 'shape') return measureShape(source.shape, ctx);
  const custom = project.library.find((c) => c.id === source.customId);
  if (!custom) return null;
  let volume = 0;
  let area = 0;
  let triangles = 0;
  let open = false;
  for (const part of custom.parts) {
    const m = measureShape(part.shape, ctx);
    const [sx, sy, sz] = part.transform.scale;
    volume += (m.volume ?? 0) * Math.abs(sx * sy * sz);
    area += m.area * Math.cbrt(Math.abs(sx * sy * sz)) ** 2;
    triangles += m.triangles;
    open ||= m.open;
  }
  return { method: 'mesh', lines: [], volume: open ? null : volume, area, triangles, open };
}

export interface NodeTotals {
  one: ShapeMeasurement;
  /** Number of objects (pattern copies × symmetry copies). */
  count: number;
  /** Σ size³ and Σ size² over the pattern (1 for a single object). */
  sumCubes: number;
  sumSquares: number;
  /** Product of the node's own stretch (scale x × y × z). */
  stretch: number;
  copies: number;
  /** Overlaps are counted twice. Null for open sheets. */
  totalVolume: number | null;
  totalArea: number;
}

export function measureNode(node: ObjectNode | PatternNode, project: Project): NodeTotals | null {
  const one = measureSource(node.source, project);
  if (!one) return null;
  const [sx, sy, sz] = node.transform.scale;
  const stretch = Math.abs(sx * sy * sz);
  const copies = symmetryCopyCount(node.symmetry);
  let sumCubes = 1;
  let sumSquares = 1;
  let perCopy = 1;
  if (node.kind === 'pattern') {
    const layout = layoutPattern(node);
    sumCubes = 0;
    sumSquares = 0;
    for (const s of layout.sizes) {
      sumCubes += s ** 3;
      sumSquares += s ** 2;
    }
    perCopy = layout.count;
  }
  return {
    one,
    count: perCopy * copies,
    sumCubes,
    sumSquares,
    stretch,
    copies,
    totalVolume: one.volume === null ? null : one.volume * sumCubes * copies * stretch,
    totalArea: one.area * sumSquares * copies * Math.cbrt(stretch) ** 2,
  };
}
