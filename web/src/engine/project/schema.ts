import { z } from 'zod';

/**
 * The project file format. Everything the student builds is stored as plain JSON
 * so it can be autosaved, undone, exported and re-opened.
 */

export const PROJECT_APP_ID = 'mathme-3d-studio';
export const PROJECT_VERSION = 1;

export const vec3Schema = z.tuple([z.number(), z.number(), z.number()]);
export const vec2Schema = z.tuple([z.number(), z.number()]);
export const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const paramValueSchema = z.union([z.number(), z.string(), z.boolean(), z.array(vec2Schema)]);
export const paramsSchema = z.record(z.string(), paramValueSchema);

export const SHAPE_TYPES = [
  'box',
  'sphere',
  'cylinder',
  'cone',
  'torus',
  'plane',
  'pyramid',
  'prism',
  'capsule',
  'tetrahedron',
  'octahedron',
  'dodecahedron',
  'icosahedron',
  'torusKnot',
  'lathe',
  'extrude',
  'text3d',
  'graphSurface',
  'parametric',
  'mesh',
] as const;

export const shapeDefSchema = z.object({
  type: z.enum(SHAPE_TYPES),
  params: paramsSchema,
});

export const transformSchema = z.object({
  position: vec3Schema,
  /** Rotation in degrees (X, Y, Z), applied in XYZ order. */
  rotation: vec3Schema,
  scale: vec3Schema,
});

export const materialSchema = z.object({
  color: hexColorSchema,
  metalness: z.number().min(0).max(1),
  roughness: z.number().min(0).max(1),
  opacity: z.number().min(0).max(1),
  wireframe: z.boolean(),
  flatShading: z.boolean(),
});

export const symmetrySchema = z.object({
  mirrorX: z.boolean(),
  mirrorY: z.boolean(),
  mirrorZ: z.boolean(),
  /** Number of copies spun evenly around the vertical (Y) axis. 1 = off. */
  radialCopies: z.number().int().min(1).max(24),
});

export const sourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('shape'), shape: shapeDefSchema }),
  z.object({ kind: z.literal('custom'), customId: z.string() }),
]);

export const PATTERN_TYPES = ['spiral', 'grid', 'circle', 'wave', 'radial', 'sphere', 'random'] as const;

export const patternDefSchema = z.object({
  type: z.enum(PATTERN_TYPES),
  params: paramsSchema,
});

export const SIZE_MODES = ['ramp', 'random', 'pulse'] as const;
export const COLOR_MODES = ['single', 'gradient', 'rainbow', 'random'] as const;

export const variationSchema = z.object({
  sizeFrom: z.number().min(0),
  sizeTo: z.number().min(0),
  sizeMode: z.enum(SIZE_MODES),
  /** Extra spin (degrees) added for each object, around its own vertical axis. */
  spinStep: z.number(),
  /** Fixed rotation (degrees) given to every object. */
  objectRotation: vec3Schema,
  /** Random rotation (0-180 degrees). */
  wobble: z.number().min(0).max(180),
  /** Turn each object to line up with the pattern (e.g. face outwards). */
  followPattern: z.boolean(),
  colorMode: z.enum(COLOR_MODES),
  colorFrom: hexColorSchema,
  colorTo: hexColorSchema,
  /** Random position shake, in length units. */
  jitter: z.number().min(0),
});

const baseNodeShape = {
  id: z.string(),
  name: z.string(),
  parentId: z.string().nullable(),
  visible: z.boolean(),
  transform: transformSchema,
  symmetry: symmetrySchema,
};

export const objectNodeSchema = z.object({
  ...baseNodeShape,
  kind: z.literal('object'),
  source: sourceSchema,
  material: materialSchema,
});

export const patternNodeSchema = z.object({
  ...baseNodeShape,
  kind: z.literal('pattern'),
  source: sourceSchema,
  material: materialSchema,
  pattern: patternDefSchema,
  count: z.number().int().min(1),
  variation: variationSchema,
  seed: z.number().int(),
});

export const groupNodeSchema = z.object({
  ...baseNodeShape,
  kind: z.literal('group'),
});

export const sceneNodeSchema = z.discriminatedUnion('kind', [
  objectNodeSchema,
  patternNodeSchema,
  groupNodeSchema,
]);

export const customPartSchema = z.object({
  shape: shapeDefSchema,
  transform: transformSchema,
  material: materialSchema,
});

export const customShapeSchema = z.object({
  id: z.string(),
  name: z.string(),
  parts: z.array(customPartSchema).min(1),
});

/** A triangle mesh produced by a boolean operation, stored as base64 typed arrays. */
export const storedMeshSchema = z.object({
  id: z.string(),
  name: z.string(),
  positions: z.string(),
  indices: z.string(),
});

export const UNITS = ['mm', 'cm', 'm'] as const;

export const projectSchema = z.object({
  app: z.literal(PROJECT_APP_ID),
  version: z.literal(PROJECT_VERSION),
  name: z.string(),
  author: z.string(),
  units: z.enum(UNITS),
  background: hexColorSchema,
  nodes: z.array(sceneNodeSchema),
  library: z.array(customShapeSchema),
  meshes: z.array(storedMeshSchema),
});
