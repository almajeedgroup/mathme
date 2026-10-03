import { parse } from 'mathjs/number';

/**
 * Safe formula evaluation for student-typed math such as `sin(x) * cos(z)`.
 *
 * mathjs is used only to *parse* the text. We then walk the syntax tree ourselves and
 * build plain JavaScript closures from an allow-list of operators, functions, constants
 * and variables, so a formula can never reach `eval`, object properties or imports.
 */

export type Scope = Record<string, number>;
export type CompiledFn = (scope: Scope) => number;

export type CompileResult = { ok: true; fn: CompiledFn } | { ok: false; error: string };

const FUNCTIONS = new Map<string, (...args: number[]) => number>(
  Object.entries({
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    asin: Math.asin,
    acos: Math.acos,
    atan: Math.atan,
    atan2: Math.atan2,
    sinh: Math.sinh,
    cosh: Math.cosh,
    tanh: Math.tanh,
    sqrt: Math.sqrt,
    cbrt: Math.cbrt,
    abs: Math.abs,
    exp: Math.exp,
    log: (x: number, base?: number) => (base === undefined ? Math.log(x) : Math.log(x) / Math.log(base)),
    ln: Math.log,
    log10: Math.log10,
    log2: Math.log2,
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
    sign: Math.sign,
    min: Math.min,
    max: Math.max,
    pow: Math.pow,
    hypot: Math.hypot,
    mod: (a: number, b: number) => ((a % b) + b) % b,
  }),
);

// Maps (not plain objects) so names like "constructor" can never be found on a prototype.
const CONSTANTS = new Map<string, number>([
  ['pi', Math.PI],
  ['e', Math.E],
  ['tau', Math.PI * 2],
  ['phi', (1 + Math.sqrt(5)) / 2],
]);

const OPERATORS = new Map<string, (a: number, b: number) => number>([
  ['add', (a, b) => a + b],
  ['subtract', (a, b) => a - b],
  ['multiply', (a, b) => a * b],
  ['divide', (a, b) => a / b],
  ['pow', (a, b) => Math.pow(a, b)],
  ['mod', (a, b) => ((a % b) + b) % b],
]);

export const ALLOWED_FUNCTION_NAMES = [...FUNCTIONS.keys()];
const MAX_LENGTH = 300;

class FormulaError extends Error {}

interface AstNode {
  type: string;
  name?: string;
  fn?: string | AstNode;
  op?: string;
  value?: unknown;
  args?: AstNode[];
  content?: AstNode;
}

function build(node: AstNode, vars: Set<string>): CompiledFn {
  switch (node.type) {
    case 'ConstantNode': {
      const v = node.value;
      if (typeof v !== 'number') throw new FormulaError('Only numbers are allowed in formulas.');
      return () => v;
    }
    case 'SymbolNode': {
      const name = node.name ?? '';
      if (vars.has(name)) return (scope) => (Object.hasOwn(scope, name) ? scope[name] : 0);
      const c = CONSTANTS.get(name);
      if (c !== undefined) return () => c;
      throw new FormulaError(
        `I don't know "${name}". You can use ${[...vars].join(', ')}, pi, e and functions like sin, cos, sqrt.`,
      );
    }
    case 'ParenthesisNode':
      return build(node.content as AstNode, vars);
    case 'OperatorNode': {
      const fnName = typeof node.fn === 'string' ? node.fn : '';
      const args = (node.args ?? []).map((a) => build(a, vars));
      if (args.length === 1) {
        const [a] = args;
        if (fnName === 'unaryMinus') return (s) => -a(s);
        if (fnName === 'unaryPlus') return a;
      } else if (args.length === 2) {
        const op = OPERATORS.get(fnName);
        const [a, b] = args;
        if (op) return (s) => op(a(s), b(s));
      }
      throw new FormulaError(`The "${node.op ?? fnName}" sign can't be used here. Try + − × ÷ ^ instead.`);
    }
    case 'FunctionNode': {
      const fnNode = node.fn as AstNode | undefined;
      const name = fnNode?.type === 'SymbolNode' ? (fnNode.name ?? '') : '';
      const impl = FUNCTIONS.get(name);
      if (!impl)
        throw new FormulaError(
          `"${name || '?'}" is not a function I know. Try sin, cos, tan, sqrt, abs, exp, log.`,
        );
      const args = (node.args ?? []).map((a) => build(a, vars));
      if (args.length === 0) throw new FormulaError(`${name}() needs something inside the brackets.`);
      return (s) => impl(...args.map((a) => a(s)));
    }
    default:
      throw new FormulaError(
        'That kind of expression is not allowed. Use numbers, letters, + − × ÷ ^ and functions.',
      );
  }
}

const cache = new Map<string, CompileResult>();

export function compileFormula(source: string, variables: string[]): CompileResult {
  const key = `${variables.join(',')}|${source}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const result = compileUncached(source, variables);
  if (cache.size > 200) cache.clear();
  cache.set(key, result);
  return result;
}

function compileUncached(source: string, variables: string[]): CompileResult {
  const text = source.trim();
  if (!text) return { ok: false, error: 'Type a formula.' };
  if (text.length > MAX_LENGTH)
    return { ok: false, error: `Formulas can be at most ${MAX_LENGTH} characters.` };
  let ast: AstNode;
  try {
    ast = parse(text) as unknown as AstNode;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const where = /char (\d+)/.exec(msg);
    return {
      ok: false,
      error: where ? `Something is wrong near character ${where[1]}.` : 'This formula has a mistake in it.',
    };
  }
  try {
    const fn = build(ast, new Set(variables));
    return {
      ok: true,
      fn: (scope) => {
        const v = fn(scope);
        return Number.isFinite(v) ? v : 0;
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof FormulaError ? e.message : 'This formula has a mistake in it.' };
  }
}

/** Evaluate a constant expression like "2*pi" (used for ranges). Returns NaN if invalid. */
export function evalConstant(source: string): number {
  const r = compileFormula(source, []);
  return r.ok ? r.fn({}) : Number.NaN;
}
