import { describe, expect, it } from 'vitest';

import { parseCommand } from '../src/engine/command/parser';

const ok = (input: string) => {
  const r = parseCommand(input);
  if (!r.ok) throw new Error(r.error);
  return r;
};

describe('command parser', () => {
  it('understands the example from the project brief exactly', () => {
    const r = ok('100 objects → Spiral → Radius 20 → Rotation 30° → Scale 0.5–2');
    expect(r.count).toBe(100);
    expect(r.shape).toBeUndefined();
    expect(r.pattern).toBe('spiral');
    expect(r.patternParams).toEqual({ radius: 20, angleStep: 30 });
    expect(r.variation).toMatchObject({ sizeFrom: 0.5, sizeTo: 2 });
    expect(r.notes).toEqual([]);
  });

  it('accepts other separators and spellings', () => {
    for (const input of [
      '100 objects -> spiral -> radius 20 -> rotation 30 -> scale 0.5-2',
      '100 objects > spiral > radius 20 > rotation 30 deg > size 0.5 to 2',
      '100 objects, spiral, radius 20, turn 30 degrees, scale 0.5 - 2',
      'make 100 objects in a spiral with radius 20 rotation 30° scale 0.5—2',
    ]) {
      const r = ok(input);
      expect(r.count, input).toBe(100);
      expect(r.patternParams, input).toEqual({ radius: 20, angleStep: 30 });
      expect(r.variation, input).toMatchObject({ sizeFrom: 0.5, sizeTo: 2 });
    }
  });

  it('shapes, patterns, colours and symmetry', () => {
    const r = ok('200 cubes on a sphere, radius 12, colour red to blue, mirror x z, seed 7');
    expect(r).toMatchObject({ count: 200, shape: 'box', pattern: 'sphere', seed: 7 });
    expect(r.patternParams).toEqual({ radius: 12 });
    expect(r.variation).toMatchObject({ colorMode: 'gradient', colorFrom: '#e03131', colorTo: '#1c7ed6' });
    expect(r.symmetry).toEqual({ mirrorX: true, mirrorZ: true });
  });

  it('"sphere" after a number is a shape, otherwise a pattern', () => {
    expect(ok('50 sphere grid')).toMatchObject({ shape: 'sphere', pattern: 'grid' });
    expect(ok('50 cones sphere')).toMatchObject({ shape: 'cone', pattern: 'sphere' });
    expect(ok('spiral of spheres')).toMatchObject({ shape: 'sphere', pattern: 'spiral' });
  });

  it('grid sizes like 10x10', () => {
    const r = ok('10x10 grid of cylinders spacing 3');
    expect(r).toMatchObject({ count: 100, shape: 'cylinder', pattern: 'grid' });
    expect(r.patternParams).toEqual({ columns: 10, rows: 10, spacing: 3 });
  });

  it('special words set pattern styles', () => {
    expect(ok('500 dots sunflower rainbow')).toMatchObject({
      pattern: 'spiral',
      patternParams: { style: 'sunflower', rise: 0 },
      variation: { colorMode: 'rainbow' },
    });
    expect(ok('40 balls helix rise 0.5').patternParams).toEqual({ style: 'helix', rise: 0.5 });
    expect(ok('ripples wave height 3').patternParams).toEqual({ style: 'ripple', amplitude: 3 });
    expect(ok('20 stars circle').shapeParams?.outline).toBeTruthy();
    expect(ok('snowflake 6 random colours').symmetry.radialCopies).toBe(6);
  });

  it('rotation on a pattern without an angle setting becomes spin', () => {
    const r = ok('100 cubes grid rotation 15');
    expect(r.variation.spinStep).toBe(15);
  });

  it('settings that do not apply become friendly notes', () => {
    const r = ok('100 cubes grid radius 5');
    expect(r.notes[0]).toContain('radius');
  });

  it('gives a friendly error for unknown words', () => {
    const r = parseCommand('100 blorps in a spiral');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.word).toBe('blorps');
      expect(r.error).toContain('blorps');
    }
    expect(parseCommand('').ok).toBe(false);
    expect(parseCommand('radius').ok).toBe(false);
    expect(parseCommand('0 cubes').ok).toBe(false);
    expect(parseCommand('scale -1').ok).toBe(false);
  });

  it('does not match built-in object names', () => {
    for (const w of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(parseCommand(`100 ${w}`).ok, w).toBe(false);
    }
  });
});

describe('example recipes in the menu', () => {
  it('all work without notes', async () => {
    const { EXAMPLE_COMMANDS } = await import('../src/engine/command/examples');
    for (const c of EXAMPLE_COMMANDS) {
      const r = parseCommand(c);
      expect(r.ok, c).toBe(true);
      if (r.ok) expect(r.notes, c).toEqual([]);
    }
  });
});
