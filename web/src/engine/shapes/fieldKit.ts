import type { NumberField } from '../fields';

/** Helpers to declare common student-friendly fields with one line each. */

export function lengthField(
  key: string,
  label: string,
  help: string,
  opts: Partial<NumberField> = {},
): NumberField {
  return {
    kind: 'number',
    key,
    label,
    help,
    unit: 'length',
    min: 0.1,
    max: 20,
    step: 0.1,
    hardMax: 1000,
    ...opts,
  };
}

export function smoothnessField(opts: Partial<NumberField> = {}): NumberField {
  return {
    kind: 'number',
    key: 'smoothness',
    label: 'Smoothness',
    help: 'How many little flat pieces make up the curve. More pieces = rounder, but slower.',
    unit: 'count',
    min: 3,
    max: 128,
    step: 1,
    integer: true,
    ...opts,
  };
}
