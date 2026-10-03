import type { ParamField } from '../fields';
import type { Rng } from '../rng';
import type { Params, PatternType, Vec3 } from '../types';

/** Where one object goes, before size/colour/spin variation is applied. */
export interface BasePlacement {
  position: Vec3;
  /** Rotation (quaternion x, y, z, w) that lines the object up with the pattern. */
  align?: [number, number, number, number];
}

/** "Show the math" text for the Learn panel. */
export interface MathExplanation {
  /** One or two plain sentences about the idea. */
  idea: string;
  /** The general formulas, one per line. */
  formulas: string[];
  /** The formulas with real numbers for one object (index i, counting from 0). */
  worked: (i: number) => string[];
}

export interface PatternDefinition {
  type: PatternType;
  label: string;
  icon: string;
  description: string;
  fields: ParamField[];
  defaults: Params;
  defaultCount: number;
  generate(params: Params, count: number, rng: Rng): BasePlacement[];
  explain(params: Params, count: number): MathExplanation;
}
