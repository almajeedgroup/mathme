import { BoxGeometry, type BufferGeometry } from 'three';

import type { ShapeDef, ShapeType } from '../types';
import { box, cone, cylinder, plane, sphere, torus } from './basic';
import {
  extrude,
  graphSurface,
  lathe,
  latheIsClosed,
  mesh,
  normalizeLatheProfile,
  parametric,
  text3d,
  tube,
} from './custom';
import { points } from '../fields';
import {
  capsule,
  dodecahedron,
  icosahedron,
  octahedron,
  prism,
  pyramid,
  tetrahedron,
  torusKnot,
} from './solids';
import type { BuildContext, ShapeDefinition } from './types';

export const SHAPES: Record<ShapeType, ShapeDefinition> = {
  box,
  sphere,
  cylinder,
  cone,
  torus,
  plane,
  pyramid,
  prism,
  capsule,
  tetrahedron,
  octahedron,
  dodecahedron,
  icosahedron,
  torusKnot,
  lathe,
  extrude,
  tube,
  text3d,
  graphSurface,
  parametric,
  mesh,
};

export const SHAPE_LIST: ShapeDefinition[] = Object.values(SHAPES);

export function getShape(type: ShapeType): ShapeDefinition {
  return SHAPES[type] ?? box;
}

/** A new shape definition with the default sizes. */
export function defaultShape(type: ShapeType): ShapeDef {
  return { type, params: structuredClone(getShape(type).defaults) };
}

/** Sheets have no inside, so draw both faces and don't report a volume. */
export function isOpenShape(def: ShapeDef): boolean {
  if (def.type === 'lathe') return !latheIsClosed(normalizeLatheProfile(points(def.params, 'profile')));
  return Boolean(getShape(def.type).open);
}

/** Build the triangle mesh for a shape. Never throws: bad input gives a small placeholder cube. */
export function buildGeometry(def: ShapeDef, ctx: BuildContext = { meshes: [] }): BufferGeometry {
  const shape = getShape(def.type);
  try {
    const g = shape.build({ ...shape.defaults, ...def.params }, ctx);
    if (!g.getAttribute('normal') && g.getAttribute('position')) g.computeVertexNormals();
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  } catch (err) {
    console.warn(`Could not build ${def.type}`, err);
    return new BoxGeometry(0.5, 0.5, 0.5);
  }
}

/** A stable key for caching geometry built from a shape definition. */
export function shapeKey(def: ShapeDef): string {
  return JSON.stringify(def);
}
