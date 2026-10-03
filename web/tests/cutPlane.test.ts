import { describe, expect, it } from 'vitest';

import { anglesFromCut, anglesToAxes, normalFromAngles, planeFromAngles } from '../src/engine/cutPlane';
import type { Vec3 } from '../src/engine/types';

describe('cut plane maths', () => {
  it('tilt 0 is a flat cut, tilt 90 turn 0 faces the front', () => {
    expect(normalFromAngles(0, 0)).toEqual([0, 1, 0]);
    const n = normalFromAngles(90, 0);
    expect(n[0]).toBeCloseTo(0);
    expect(n[1]).toBeCloseTo(0);
    expect(n[2]).toBeCloseTo(1);
    const side = normalFromAngles(90, 90);
    expect(side[0]).toBeCloseTo(1);
  });

  it('a preset plane survives the round trip through tilt/turn/slide', () => {
    const centre: Vec3 = [1, 2, 3];
    const normal: Vec3 = [0.054, 0.881, 0.47];
    const point: Vec3 = [7.3, 4.5, 8.3];
    const a = anglesFromCut(point, normal, centre);
    const eq = planeFromAngles(a, centre);
    const len = Math.hypot(...normal);
    normal.forEach((v, i) => expect(eq.normal[i]).toBeCloseTo(v / len, 9));
    const d = (normal[0] * point[0] + normal[1] * point[1] + normal[2] * point[2]) / len;
    expect(eq.d).toBeCloseTo(d, 9);
  });

  it('angles to the axes', () => {
    expect(anglesToAxes([0, 1, 0])).toEqual({ x: 90, y: 0, z: 90 });
    const a = anglesToAxes(normalFromAngles(45, 0));
    expect(a.y).toBeCloseTo(45);
    expect(a.z).toBeCloseTo(45);
  });
});
