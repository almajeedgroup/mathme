import type { ShapeDef, Vec2, Vec3 } from '../types';

/**
 * Turning 2D sketch shapes into 3D objects that stand on the floor of the 3D view.
 * Looking down from above, sketch x is world x and sketch y points away from you (world −z).
 * Flat shapes are built in their own x–y plane and laid down by turning −90° around X (y → −z).
 */
export interface Placed {
  shape: ShapeDef;
  position: Vec3;
  rotation: Vec3;
}

const r2 = (v: number) => Number(v.toFixed(3));

function centreOf(pts: Vec2[]) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

/** A closed outline pushed up into a solid of the given height. */
export function pushUpLoop(poly: Vec2[], height: number): Placed {
  const { cx, cy } = centreOf(poly);
  return {
    shape: {
      type: 'extrude',
      params: {
        outline: poly.map(([x, y]) => [r2(x - cx), r2(y - cy)]),
        depth: height,
        bevel: false,
        bevelSize: 0.1,
      },
    },
    position: [r2(cx), height / 2, r2(-cy)],
    rotation: [-90, 0, 0],
  };
}

/** A circle pushed up into a cylinder. */
export function pushUpCircle(centre: Vec2, r: number, height: number): Placed {
  return {
    shape: { type: 'cylinder', params: { radiusTop: r, radiusBottom: r, height, smoothness: 48 } },
    position: [r2(centre[0]), height / 2, r2(-centre[1])],
    rotation: [0, 0, 0],
  };
}

/**
 * Lines spun around the sketch's up-and-down axis (x = 0), like a potter's wheel. Distance from the axis is
 * |x|; height is y. The object keeps the sketch's heights in the 3D view.
 */
export function spinChain(points: Vec2[]): Placed | null {
  if (points.length < 2) return null;
  const profile: Vec2[] = points.map(([x, y]) => [r2(Math.abs(x)), r2(y)]);
  const ys = profile.map((p) => p[1]);
  return {
    shape: { type: 'lathe', params: { profile, smoothness: 64 } },
    position: [0, r2((Math.min(...ys) + Math.max(...ys)) / 2), 0],
    rotation: [0, 0, 0],
  };
}
