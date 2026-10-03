import type { BufferGeometry } from 'three';

import type { ParamField } from '../fields';
import type { Params, ShapeType, StoredMesh } from '../types';

/** One line of "show your working" maths for a shape. */
export interface FormulaLine {
  /** What is being measured, e.g. "Volume". */
  quantity: string;
  /** The general formula, e.g. "V = π × r² × h". */
  formula: string;
  /** The formula with the student's numbers put in. */
  working: string;
  value: number;
  /** 1 = length, 2 = area, 3 = volume. */
  power: 1 | 2 | 3;
}

export interface BuildContext {
  meshes: StoredMesh[];
}

export type ShapeCategory = 'basic' | 'solid' | 'custom';

export interface ShapeDefinition {
  type: ShapeType;
  label: string;
  /** Short, friendly description shown in the library and the inspector. */
  description: string;
  icon: string;
  category: ShapeCategory;
  fields: ParamField[];
  defaults: Params;
  /** Open surfaces (sheets) have no inside, so both sides are drawn and they have no volume. */
  open?: boolean;
  /** Hidden from the add-shape library (e.g. meshes made by Combine/Cut). */
  hidden?: boolean;
  build(params: Params, ctx: BuildContext): BufferGeometry;
  formulas?(params: Params): FormulaLine[];
}
