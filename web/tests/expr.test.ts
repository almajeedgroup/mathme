import { describe, expect, it } from 'vitest';

import { compileFormula, evalConstant } from '../src/engine/expr';

const run = (src: string, scope: Record<string, number> = {}, vars = ['x', 'z']) => {
  const r = compileFormula(src, vars);
  if (!r.ok) throw new Error(r.error);
  return r.fn(scope);
};

describe('formula evaluator', () => {
  it('handles everyday maths', () => {
    expect(run('1 + 2 * 3')).toBe(7);
    expect(run('2^3')).toBe(8);
    expect(run('-x + 4', { x: 1 })).toBe(3);
    expect(run('sin(pi/2)')).toBeCloseTo(1);
    expect(run('sqrt(x^2 + z^2)', { x: 3, z: 4 })).toBe(5);
    expect(run('2x', { x: 5 })).toBe(10); // implicit multiplication
    expect(run('abs(-3) + max(1, 4) + floor(2.7)')).toBe(9);
    expect(run('7 mod 3')).toBe(1);
    expect(evalConstant('2*pi')).toBeCloseTo(Math.PI * 2);
  });

  it('returns 0 instead of Infinity/NaN', () => {
    expect(run('1/0')).toBe(0);
    expect(run('sqrt(-1)')).toBe(0);
  });

  it('gives friendly errors', () => {
    const unknown = compileFormula('q + 1', ['x', 'z']);
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error).toContain('"q"');
    expect(compileFormula('sin(', ['x']).ok).toBe(false);
    expect(compileFormula('', ['x']).ok).toBe(false);
  });

  it('rejects anything that is not plain maths', () => {
    const attacks = [
      'constructor',
      'x.constructor',
      'import({}, {override: true})',
      'evaluate("1+1")',
      'f(x) = x',
      'a = 5',
      '[1, 2, 3]',
      '{a: 1}',
      'x[1]',
      '"text"',
      'cos.constructor("return process")()',
      'createUnit("foo")',
      'x == 1 ? 1 : 2',
      '1:3',
      'x!',
      'x; x',
    ];
    for (const src of attacks) expect(compileFormula(src, ['x']).ok, src).toBe(false);
    expect(compileFormula('x'.repeat(301), ['x']).ok).toBe(false);
  });
});
