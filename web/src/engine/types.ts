import type { z } from 'zod';

import type {
  customPartSchema,
  customShapeSchema,
  cutPresetSchema,
  groupNodeSchema,
  materialSchema,
  objectNodeSchema,
  paramsSchema,
  paramValueSchema,
  patternDefSchema,
  patternNodeSchema,
  projectSchema,
  sceneNodeSchema,
  shapeDefSchema,
  sourceSchema,
  storedMeshSchema,
  symmetrySchema,
  transformSchema,
  variationSchema,
} from './project/schema';
import type { COLOR_MODES, PATTERN_TYPES, SHAPE_TYPES, SIZE_MODES, UNITS } from './project/schema';

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

export type ShapeType = (typeof SHAPE_TYPES)[number];
export type PatternType = (typeof PATTERN_TYPES)[number];
export type SizeMode = (typeof SIZE_MODES)[number];
export type ColorMode = (typeof COLOR_MODES)[number];
export type Units = (typeof UNITS)[number];

export type ParamValue = z.infer<typeof paramValueSchema>;
export type Params = z.infer<typeof paramsSchema>;
export type ShapeDef = z.infer<typeof shapeDefSchema>;
export type Transform = z.infer<typeof transformSchema>;
export type MaterialDef = z.infer<typeof materialSchema>;
export type SymmetryDef = z.infer<typeof symmetrySchema>;
export type SourceRef = z.infer<typeof sourceSchema>;
export type PatternDef = z.infer<typeof patternDefSchema>;
export type VariationDef = z.infer<typeof variationSchema>;
export type ObjectNode = z.infer<typeof objectNodeSchema>;
export type PatternNode = z.infer<typeof patternNodeSchema>;
export type GroupNode = z.infer<typeof groupNodeSchema>;
export type SceneNode = z.infer<typeof sceneNodeSchema>;
export type CustomPart = z.infer<typeof customPartSchema>;
export type CustomShape = z.infer<typeof customShapeSchema>;
export type StoredMesh = z.infer<typeof storedMeshSchema>;
export type CutPreset = z.infer<typeof cutPresetSchema>;
export type Project = z.infer<typeof projectSchema>;

/** Nodes that draw geometry (as opposed to groups). */
export type DrawableNode = ObjectNode | PatternNode;
