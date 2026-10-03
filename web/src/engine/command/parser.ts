import { getPattern } from '../patterns/registry';
import type { ParamValue, Params, PatternType, ShapeType, SymmetryDef, Vec2, VariationDef } from '../types';
import { OUTLINE_PRESETS } from '../shapes/profiles';

/**
 * Turns a student's "recipe" into a pattern, for example
 *   100 objects → Spiral → Radius 20 → Rotation 30° → Scale 0.5–2
 *   200 cubes on a sphere, radius 12, rainbow
 *   10 x 10 grid of cylinders spacing 3 colour red to blue
 */

export interface ParsedCommand {
  count?: number;
  shape?: ShapeType;
  /** Extra shape settings (e.g. the star outline for "stars"). */
  shapeParams?: Params;
  pattern?: PatternType;
  /** Settings for the pattern, already matched to its field names. */
  patternParams: Params;
  variation: Partial<VariationDef>;
  symmetry: Partial<SymmetryDef>;
  materialColor?: string;
  seed?: number;
  /** Things we understood but could not use. */
  notes: string[];
}

export type CommandResult = ({ ok: true } & ParsedCommand) | { ok: false; error: string; word?: string };

export const COLOR_NAMES: Record<string, string> = {
  red: '#e03131',
  orange: '#f76707',
  yellow: '#fcc419',
  gold: '#f59f00',
  green: '#2f9e44',
  lime: '#82c91e',
  teal: '#0ca678',
  cyan: '#1098ad',
  blue: '#1c7ed6',
  navy: '#1b3a6b',
  indigo: '#4263eb',
  purple: '#7048e8',
  violet: '#7048e8',
  magenta: '#d6336c',
  pink: '#f06595',
  brown: '#8b5a2b',
  white: '#ffffff',
  black: '#212529',
  gray: '#868e96',
  grey: '#868e96',
  silver: '#ced4da',
};

const SHAPE_WORDS: Record<string, ShapeType> = {
  cube: 'box',
  cubes: 'box',
  box: 'box',
  boxes: 'box',
  cuboid: 'box',
  cuboids: 'box',
  block: 'box',
  blocks: 'box',
  spheres: 'sphere',
  ball: 'sphere',
  balls: 'sphere',
  dot: 'sphere',
  dots: 'sphere',
  cylinder: 'cylinder',
  cylinders: 'cylinder',
  can: 'cylinder',
  cans: 'cylinder',
  cone: 'cone',
  cones: 'cone',
  torus: 'torus',
  tori: 'torus',
  toruses: 'torus',
  donut: 'torus',
  donuts: 'torus',
  doughnut: 'torus',
  doughnuts: 'torus',
  plane: 'plane',
  planes: 'plane',
  sheet: 'plane',
  sheets: 'plane',
  tile: 'plane',
  tiles: 'plane',
  pyramid: 'pyramid',
  pyramids: 'pyramid',
  prism: 'prism',
  prisms: 'prism',
  capsule: 'capsule',
  capsules: 'capsule',
  pill: 'capsule',
  pills: 'capsule',
  tetrahedron: 'tetrahedron',
  tetrahedrons: 'tetrahedron',
  octahedron: 'octahedron',
  octahedrons: 'octahedron',
  dodecahedron: 'dodecahedron',
  dodecahedrons: 'dodecahedron',
  icosahedron: 'icosahedron',
  icosahedrons: 'icosahedron',
  knot: 'torusKnot',
  knots: 'torusKnot',
  star: 'extrude',
  stars: 'extrude',
  heart: 'extrude',
  hearts: 'extrude',
  vase: 'lathe',
  vases: 'lathe',
};

const OUTLINE_FOR: Record<string, string> = { star: 'star', stars: 'star', heart: 'heart', hearts: 'heart' };

/** Pattern words, with optional settings they imply. */
const PATTERN_WORDS: Record<string, { type: PatternType; params?: Params }> = {
  spiral: { type: 'spiral' },
  spirals: { type: 'spiral' },
  helix: { type: 'spiral', params: { style: 'helix' } },
  spring: { type: 'spiral', params: { style: 'helix' } },
  sunflower: { type: 'spiral', params: { style: 'sunflower', rise: 0 } },
  grid: { type: 'grid' },
  circle: { type: 'circle' },
  ring: { type: 'circle' },
  wave: { type: 'wave', params: { style: 'lines' } },
  waves: { type: 'wave', params: { style: 'lines' } },
  ripple: { type: 'wave', params: { style: 'ripple' } },
  ripples: { type: 'wave', params: { style: 'ripple' } },
  radial: { type: 'radial' },
  rings: { type: 'radial' },
  target: { type: 'radial' },
  sunburst: { type: 'radial' },
  sphere: { type: 'sphere' },
  globe: { type: 'sphere' },
  dome: { type: 'sphere', params: { coverage: 'dome' } },
  random: { type: 'random' },
  scatter: { type: 'random' },
  scattered: { type: 'random' },
  cloud: { type: 'random', params: { area: 'ball' } },
};

/** Words that need a number after them. The value is the "generic" setting name. */
const VALUE_WORDS: Record<string, string> = {
  radius: 'radius',
  width: 'width',
  rotation: 'rotation',
  rotate: 'rotation',
  turn: 'rotation',
  turns: 'rotation',
  angle: 'rotation',
  step: 'rotation',
  spacing: 'spacing',
  gap: 'spacing',
  distance: 'spacing',
  height: 'height',
  rise: 'rise',
  climb: 'rise',
  columns: 'columns',
  cols: 'columns',
  rows: 'rows',
  amplitude: 'amplitude',
  wavelength: 'wavelength',
  arc: 'arc',
  depth: 'depth',
  start: 'start',
};

const FILLER = new Set([
  'a',
  'an',
  'the',
  'of',
  'in',
  'on',
  'with',
  'and',
  'into',
  'as',
  'at',
  'by',
  'to',
  'make',
  'create',
  'draw',
  'place',
  'put',
  'arrange',
  'arranged',
  'pattern',
  'shape',
  'shaped',
  'objects',
  'object',
  'things',
  'thing',
  'items',
  'item',
  'copies',
  'copy',
  'pieces',
  'shapes',
  'deg',
  'degree',
  'degrees',
  'cm',
  'mm',
  'units',
  'unit',
  'each',
  'every',
  'per',
  'please',
  'from',
  'around',
  'layout',
  'form',
  'formation',
  'colors',
  'colours',
]);

type Token =
  | { kind: 'num'; value: number; text: string }
  | { kind: 'word'; value: string; text: string }
  | { kind: 'dash'; text: string };

function tokenize(input: string): Token[] {
  const text = input
    .toLowerCase()
    .replace(/→|->|=>|>|,|;|\||:/g, ' ')
    .replace(/(\d)\s*x\s*(\d)/g, '$1 by $2') // 10x10
    .replace(/(\d)\s*×\s*(\d)/g, '$1 by $2');
  const out: Token[] = [];
  const re = /(\d+(?:\.\d+)?|\.\d+)|(#[0-9a-f]{6}\b|[a-z][a-z0-9]*)|([–—-]|\.\.)|(°|%)/g;
  for (const m of text.matchAll(re)) {
    if (m[1]) out.push({ kind: 'num', value: Number(m[1]), text: m[1] });
    else if (m[2]) out.push({ kind: 'word', value: m[2], text: m[2] });
    else if (m[3]) out.push({ kind: 'dash', text: m[3] });
  }
  return out;
}

class ParseError extends Error {
  constructor(
    message: string,
    public word?: string,
  ) {
    super(message);
  }
}

/** Own-property lookup, so words like "constructor" never match Object.prototype. */
const has = (table: object, key: string) => Object.hasOwn(table, key);
const isColorWord = (w: string) => has(COLOR_NAMES, w) || /^#[0-9a-f]{6}$/.test(w);
const colorOf = (w: string) => (has(COLOR_NAMES, w) ? COLOR_NAMES[w] : w);

export function parseCommand(input: string): CommandResult {
  const tokens = tokenize(input);
  if (tokens.length === 0)
    return { ok: false, error: 'Type a recipe, for example: 100 spheres → spiral → radius 20' };
  let i = 0;
  const peek = (k = 0) => tokens[i + k];
  const wordAt = (k = 0) => {
    const t = tokens[i + k];
    return t?.kind === 'word' ? t.value : undefined;
  };
  const result: ParsedCommand = { patternParams: {}, variation: {}, symmetry: {}, notes: [] };
  const generic: [string, number][] = [];
  const patternExtras: Params = {};

  const readNumber = (after: string): number => {
    let sign = 1;
    if (peek()?.kind === 'dash') {
      sign = -1;
      i++;
    }
    const t = peek();
    if (t?.kind !== 'num')
      throw new ParseError(`“${after}” needs a number after it, like “${after} 10”.`, after);
    i++;
    if (wordAt() === 'percent') i++;
    return sign * t.value;
  };

  /** A number, or a range like "0.5–2" / "0.5 to 2". */
  const readRange = (after: string): [number, number] => {
    const a = readNumber(after);
    const t = peek();
    if (t?.kind === 'dash' || (t?.kind === 'word' && t.value === 'to')) {
      if (tokens[i + 1]?.kind === 'num' || tokens[i + 1]?.kind === 'dash') {
        i++;
        return [a, readNumber(after)];
      }
    }
    return [a, a];
  };

  const readColors = () => {
    const t = peek();
    if (t?.kind === 'word' && t.value === 'rainbow') {
      i++;
      result.variation.colorMode = 'rainbow';
      return;
    }
    if (t?.kind === 'word' && t.value === 'random') {
      i++;
      result.variation.colorMode = 'random';
      return;
    }
    if (t?.kind !== 'word' || !isColorWord(t.value))
      throw new ParseError(
        'After “colour”, name a colour (red, blue, #ff8800…), “rainbow” or “random”.',
        t?.text,
      );
    i++;
    const first = colorOf(t.value);
    const sep = peek();
    if (
      sep &&
      (sep.kind === 'dash' || (sep.kind === 'word' && (sep.value === 'to' || sep.value === 'and')))
    ) {
      const second = peek(1);
      if (second?.kind === 'word' && isColorWord(second.value)) {
        i += 2;
        result.variation.colorMode = 'gradient';
        result.variation.colorFrom = first;
        result.variation.colorTo = colorOf(second.value);
        return;
      }
    }
    result.variation.colorMode = 'single';
    result.materialColor = first;
  };

  try {
    while (i < tokens.length) {
      const t = tokens[i];
      if (t.kind === 'num') {
        i++;
        const next = peek();
        // "10 by 10 grid" → columns × rows
        const rowsToken = peek(1);
        if (wordAt() === 'by' && rowsToken?.kind === 'num') {
          const rows = rowsToken.value;
          i += 2;
          generic.push(['columns', t.value], ['rows', rows]);
          result.count ??= t.value * rows;
          continue;
        }
        result.count = t.value;
        if (next?.kind === 'word' && (has(SHAPE_WORDS, next.value) || next.value === 'sphere')) {
          i++;
          result.shape = next.value === 'sphere' ? 'sphere' : SHAPE_WORDS[next.value];
          if (has(OUTLINE_FOR, next.value)) result.shapeParams = outlineParams(OUTLINE_FOR[next.value]);
        }
        continue;
      }
      if (t.kind === 'dash') {
        i++;
        continue;
      }
      const w = t.value;
      i++;
      if (FILLER.has(w)) continue;
      if (w === 'color' || w === 'colour' || w === 'coloured' || w === 'colored') {
        readColors();
      } else if (w === 'rainbow') {
        result.variation.colorMode = 'rainbow';
      } else if (isColorWord(w)) {
        i--;
        readColors();
      } else if (w === 'random' && /^(colou?rs?)$/.test(wordAt() ?? '')) {
        i++;
        result.variation.colorMode = 'random';
      } else if (w === 'random' && /^sizes?$/.test(wordAt() ?? '')) {
        i++;
        result.variation.sizeMode = 'random';
      } else if (w === 'scale' || w === 'size' || w === 'sizes' || w === 'grow' || w === 'growing') {
        const [a, b] = readRange(w);
        if (a < 0 || b < 0) throw new ParseError('Sizes cannot be negative.', w);
        result.variation.sizeFrom = a;
        result.variation.sizeTo = b;
      } else if (w === 'spin') {
        result.variation.spinStep = readNumber(w);
      } else if (w === 'wobble' || w === 'tilt') {
        result.variation.wobble = Math.min(180, Math.abs(readNumber(w)));
      } else if (w === 'shake' || w === 'jitter') {
        result.variation.jitter = Math.abs(readNumber(w));
      } else if (w === 'seed') {
        result.seed = Math.round(Math.abs(readNumber(w)));
      } else if (w === 'count' || w === 'number' || w === 'amount') {
        result.count = readNumber(w);
      } else if (w === 'mirror' || w === 'mirrored' || w === 'symmetry' || w === 'symmetric') {
        let axisGiven = false;
        while (['x', 'y', 'z'].includes(wordAt() ?? '')) {
          const axis = wordAt();
          i++;
          axisGiven = true;
          if (axis === 'x') result.symmetry.mirrorX = true;
          if (axis === 'y') result.symmetry.mirrorY = true;
          if (axis === 'z') result.symmetry.mirrorZ = true;
        }
        if (!axisGiven) result.symmetry.mirrorX = true;
      } else if (w === 'kaleidoscope' || w === 'snowflake') {
        result.symmetry.radialCopies = peek()?.kind === 'num' ? Math.round(readNumber(w)) : 6;
      } else if (w === 'wave' && wordAt() === 'height') {
        i++;
        generic.push(['amplitude', readNumber('wave height')]);
      } else if (has(VALUE_WORDS, w)) {
        generic.push([VALUE_WORDS[w], readNumber(w)]);
      } else if (w === 'spheres') {
        result.shape = 'sphere';
      } else if (has(SHAPE_WORDS, w)) {
        result.shape = SHAPE_WORDS[w];
        if (has(OUTLINE_FOR, w)) result.shapeParams = outlineParams(OUTLINE_FOR[w]);
      } else if (has(PATTERN_WORDS, w)) {
        const p = PATTERN_WORDS[w];
        result.pattern = p.type;
        Object.assign(patternExtras, p.params ?? {});
      } else {
        throw new ParseError(
          `I don't understand “${t.text}”. Try words like spiral, grid, circle, radius, rotation, size or colour.`,
          t.text,
        );
      }
    }
  } catch (e) {
    if (e instanceof ParseError) return { ok: false, error: e.message, word: e.word };
    throw e;
  }

  if (result.count !== undefined) {
    if (!Number.isFinite(result.count) || result.count < 1)
      return { ok: false, error: 'The number of objects must be 1 or more.' };
    result.count = Math.round(result.count);
  }
  if (!result.pattern && (generic.length || result.count !== undefined)) result.pattern = 'spiral';

  // match generic words ("radius", "rotation"...) to the chosen pattern's own settings
  if (result.pattern) {
    const def = getPattern(result.pattern);
    Object.assign(result.patternParams, patternExtras);
    for (const [word, value] of generic) {
      const field = def.fields.find((f) => f.aliases?.includes(word));
      if (field) result.patternParams[field.key] = value as ParamValue;
      else if (word === 'rotation') result.variation.spinStep = value;
      else
        result.notes.push(`“${word}” isn't used by the ${def.label.toLowerCase()} pattern, so I skipped it.`);
    }
  } else if (generic.length) {
    result.notes.push('Add a pattern word like spiral or grid to use those settings.');
  }
  return { ok: true, ...result };
}

function outlineParams(id: string): Params {
  const preset = OUTLINE_PRESETS.find((p) => p.id === id);
  return preset ? { outline: preset.points as Vec2[] } : {};
}

/** A plain-English summary of what a parsed command will make. */
export function describeCommand(c: ParsedCommand): string {
  const parts: string[] = [];
  const shape = c.shape ? (c.shape === 'box' ? 'cubes' : `${c.shape}s`) : 'objects';
  parts.push(`${c.count ?? (c.pattern ? getPattern(c.pattern).defaultCount : '')} ${shape}`.trim());
  if (c.pattern) parts.push(`in a ${getPattern(c.pattern).label.toLowerCase()}`);
  for (const [k, v] of Object.entries(c.patternParams)) parts.push(`${k} ${v}`);
  const { sizeFrom, sizeTo } = c.variation;
  if (sizeFrom !== undefined)
    parts.push(sizeFrom === sizeTo ? `size ${sizeFrom}` : `size ${sizeFrom}–${sizeTo}`);
  if (c.variation.colorMode) parts.push(`${c.variation.colorMode} colours`);
  return parts.join(', ');
}
