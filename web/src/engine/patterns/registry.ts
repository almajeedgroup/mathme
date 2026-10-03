import type { PatternDef, PatternType } from '../types';
import { circle } from './circle';
import { grid } from './grid';
import { radial } from './radial';
import { random } from './random';
import { spherePattern } from './sphere';
import { spiral } from './spiral';
import type { PatternDefinition } from './types';
import { wave } from './wave';

export const PATTERNS: Record<PatternType, PatternDefinition> = {
  spiral,
  grid,
  circle,
  wave,
  radial,
  sphere: spherePattern,
  random,
};

export const PATTERN_LIST: PatternDefinition[] = Object.values(PATTERNS);

export function getPattern(type: PatternType): PatternDefinition {
  return PATTERNS[type] ?? spiral;
}

export function defaultPattern(type: PatternType): PatternDef {
  return { type, params: structuredClone(getPattern(type).defaults) };
}
