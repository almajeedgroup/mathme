import type { ParamValue, Params } from './types';

/**
 * Field descriptions drive the inspector UI. Every number field has a
 * student-friendly label, a one-line help text and a unit.
 */

export type FieldUnit = 'length' | 'angle' | 'count' | 'factor' | 'none';

interface FieldBase {
  key: string;
  label: string;
  help: string;
  /** Only show this field when the condition holds (e.g. a mode switch). */
  visibleIf?: (params: Params) => boolean;
  /** Command-bar words that set this field (e.g. "radius"). */
  aliases?: string[];
}

export interface NumberField extends FieldBase {
  kind: 'number';
  unit: FieldUnit;
  min: number;
  max: number;
  step: number;
  /** Values typed into the number box may go up to this (the slider stops at max). */
  hardMax?: number;
  integer?: boolean;
}

export interface SelectField extends FieldBase {
  kind: 'select';
  options: { value: string; label: string }[];
}

export interface BooleanField extends FieldBase {
  kind: 'boolean';
}

export interface TextField extends FieldBase {
  kind: 'text';
  placeholder?: string;
  /** Text is a math formula; the UI validates it. */
  formulaVars?: string[];
}

export interface PointsField extends FieldBase {
  kind: 'points';
  /**
   * profile = half-outline spun around the axis (x = distance from axis); outline = closed 2D shape;
   * path = an open line (for tubes).
   */
  mode: 'profile' | 'outline' | 'path';
}

export type ParamField = NumberField | SelectField | BooleanField | TextField | PointsField;

export function num(params: Params, key: string, fallback = 0): number {
  const v = params[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export function str(params: Params, key: string, fallback = ''): string {
  const v = params[key];
  return typeof v === 'string' ? v : fallback;
}

export function bool(params: Params, key: string, fallback = false): boolean {
  const v = params[key];
  return typeof v === 'boolean' ? v : fallback;
}

export function points(params: Params, key: string): [number, number][] {
  const v = params[key];
  return Array.isArray(v) ? v : [];
}

/** Clamp a number into a field's allowed range (rounding integers). */
export function clampToField(field: NumberField, value: number): number {
  const max = field.hardMax ?? field.max;
  let v = Math.min(max, Math.max(field.min, value));
  if (field.integer) v = Math.round(v);
  return v;
}

export function isParamValue(v: unknown): v is ParamValue {
  return typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean' || Array.isArray(v);
}
