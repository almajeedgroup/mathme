import { describe, expect, it } from 'vitest';

import { floorDrawing, polygonArea, simplifyLine } from '../src/engine/drawing';
import { buildGeometry, getShape } from '../src/engine/shapes/registry';
import type { Params } from '../src/engine/types';

describe('pencil drawings', () => {
  it('simplifies a wobbly straight line to its ends', () => {
    const line: [number, number][] = Array.from({ length: 50 }, (_, i) => [i / 10, (i % 2) * 0.01]);
    expect(simplifyLine(line, 0.05)).toEqual([line[0], line[49]]);
  });

  it('keeps the corners of a hand-drawn square and spots the loop', () => {
    const square: [number, number][] = [];
    const corners: [number, number][] = [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
      [0, 0.1],
    ];
    for (let c = 0; c < corners.length - 1; c++) {
      for (let t = 0; t < 10; t++) {
        const [x1, z1] = corners[c];
        const [x2, z2] = corners[c + 1];
        square.push([x1 + ((x2 - x1) * t) / 10, z1 + ((z2 - z1) * t) / 10]);
      }
    }
    square.push(corners[4]);
    const d = floorDrawing(square, 0.06)!;
    expect(d.loop).toBe(true);
    expect(d.points).toHaveLength(4);
    expect(d.centre).toEqual({ x: 2, z: 2 });
    expect(polygonArea(d.points)).toBeCloseTo(16, 0);
    // floor z becomes −y in the flat shape (it is laid down by turning −90° around X)
    expect(d.points).toContainEqual([2, 2]);
  });

  it('builds a tube with round ends and the right volume', () => {
    const params: Params = {
      path: [
        [0, 0],
        [10, 0],
      ],
      radius: 0.5,
      smooth: false,
      closed: false,
    };
    const g = buildGeometry({ type: 'tube', params });
    g.computeBoundingBox();
    const size = g.boundingBox!.max.clone().sub(g.boundingBox!.min);
    expect(size.x).toBeCloseTo(11, 1); // 10 long plus a half-ball at each end
    const volume = getShape('tube').formulas!(params).find((f) => f.quantity === 'Volume')!;
    expect(volume.value).toBeCloseTo(Math.PI * 0.25 * 10 + (4 / 3) * Math.PI * 0.125, 6);
  });
});
