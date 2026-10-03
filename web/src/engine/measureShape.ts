import { buildGeometry, getShape, isOpenShape } from './shapes/registry';
import { measureGeometry } from './shapes/measure';
import type { BuildContext, FormulaLine } from './shapes/types';
import type { ShapeDef } from './types';

export interface ShapeMeasurement {
  /** 'formula' = exact school formula, 'mesh' = measured by adding up the triangles. */
  method: 'formula' | 'mesh';
  lines: FormulaLine[];
  volume: number | null;
  area: number;
  triangles: number;
  open: boolean;
}

export function measureShape(def: ShapeDef, ctx: BuildContext = { meshes: [] }): ShapeMeasurement {
  const shape = getShape(def.type);
  const params = { ...shape.defaults, ...def.params };
  const open = isOpenShape(def);
  const geometry = buildGeometry(def, ctx);
  const mesh = measureGeometry(geometry);
  geometry.dispose();
  const lines = shape.formulas?.(params) ?? [];
  const vol = lines.find((l) => l.quantity === 'Volume');
  const area = lines.find((l) => l.quantity === 'Surface area' || l.quantity === 'Area');
  if (vol || area) {
    return {
      method: 'formula',
      lines,
      volume: open ? null : (vol?.value ?? mesh.volume),
      area: area?.value ?? mesh.area,
      triangles: mesh.triangles,
      open,
    };
  }
  return {
    method: 'mesh',
    lines,
    volume: open ? null : mesh.volume,
    area: mesh.area,
    triangles: mesh.triangles,
    open,
  };
}
