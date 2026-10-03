import type { Vec2 } from '../types';

/**
 * Ready-made 2D profiles. Lathe profiles are [distance from axis, height] points that get
 * spun around the vertical axis. Outlines are closed [x, y] polygons that get pushed out
 * into 3D (extruded).
 */

export interface ProfilePreset {
  id: string;
  label: string;
  points: Vec2[];
}

export const LATHE_PRESETS: ProfilePreset[] = [
  {
    id: 'vase',
    label: 'Vase',
    points: [
      [0, 0],
      [1.2, 0],
      [1.5, 0.6],
      [1.6, 1.4],
      [1.2, 2.4],
      [0.8, 3.2],
      [0.9, 3.8],
      [1.1, 4.2],
      [0.95, 4.2],
      [0.75, 3.8],
      [0.65, 3.2],
      [1.05, 2.4],
      [1.45, 1.4],
      [1.35, 0.6],
      [1.05, 0.2],
      [0, 0.2],
    ],
  },
  {
    id: 'bowl',
    label: 'Bowl',
    points: [
      [0, 0],
      [1, 0],
      [1.8, 0.5],
      [2.2, 1.4],
      [2.0, 1.4],
      [1.65, 0.65],
      [0.9, 0.15],
      [0, 0.15],
    ],
  },
  {
    id: 'goblet',
    label: 'Goblet',
    points: [
      [0, 0],
      [1.0, 0],
      [1.0, 0.12],
      [0.25, 0.25],
      [0.18, 1.6],
      [0.3, 2.0],
      [1.0, 2.6],
      [1.2, 3.6],
      [1.1, 3.6],
      [0.9, 2.7],
      [0.25, 2.15],
      [0, 2.15],
    ],
  },
  {
    id: 'spinning-top',
    label: 'Spinning top',
    points: [
      [0, 0],
      [0.6, 0.6],
      [1.5, 1.2],
      [1.5, 1.4],
      [0.3, 1.8],
      [0.15, 2.6],
      [0, 2.6],
    ],
  },
  { id: 'egg', label: 'Egg', points: eggProfile() },
];

function eggProfile(): Vec2[] {
  const pts: Vec2[] = [];
  const n = 20;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI; // 0 = bottom, π = top
    const y = 1.5 * (1 - Math.cos(t));
    const r = Math.sin(t) * (1 - 0.18 * (y / 3)) * 1.05;
    pts.push([Number(Math.max(0, r).toFixed(3)), Number(y.toFixed(3))]);
  }
  return pts;
}

function regularPolygon(n: number, r: number, startDeg = 90): Vec2[] {
  return Array.from({ length: n }, (_, i) => {
    const a = ((startDeg + (360 * i) / n) * Math.PI) / 180;
    return [Number((r * Math.cos(a)).toFixed(3)), Number((r * Math.sin(a)).toFixed(3))] as Vec2;
  });
}

function star(points: number, outer: number, inner: number): Vec2[] {
  return Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = ((90 + (180 * i) / points) * Math.PI) / 180;
    return [Number((r * Math.cos(a)).toFixed(3)), Number((r * Math.sin(a)).toFixed(3))] as Vec2;
  });
}

function heart(): Vec2[] {
  const pts: Vec2[] = [];
  const n = 40;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push([Number((x / 10).toFixed(3)), Number((y / 10).toFixed(3))]);
  }
  return pts;
}

export const OUTLINE_PRESETS: ProfilePreset[] = [
  { id: 'star', label: 'Star', points: star(5, 1.5, 0.65) },
  { id: 'heart', label: 'Heart', points: heart() },
  { id: 'hexagon', label: 'Hexagon', points: regularPolygon(6, 1.5, 0) },
  {
    id: 'arrow',
    label: 'Arrow',
    points: [
      [-2, 0.4],
      [0.6, 0.4],
      [0.6, 1],
      [2, 0],
      [0.6, -1],
      [0.6, -0.4],
      [-2, -0.4],
    ],
  },
  {
    id: 'l-shape',
    label: 'L-shape',
    points: [
      [0, 0],
      [2, 0],
      [2, 0.6],
      [0.6, 0.6],
      [0.6, 2.5],
      [0, 2.5],
    ],
  },
  {
    id: 'lightning',
    label: 'Lightning',
    points: [
      [0.2, 2.5],
      [1.4, 2.5],
      [0.8, 1.2],
      [1.6, 1.2],
      [-0.2, -1.5],
      [0.4, 0.4],
      [-0.4, 0.4],
    ],
  },
  {
    id: 'house',
    label: 'House',
    points: [
      [-1.2, 0],
      [1.2, 0],
      [1.2, 1.5],
      [0, 2.6],
      [-1.2, 1.5],
    ],
  },
];

export interface FormulaPreset {
  id: string;
  label: string;
  params: Record<string, string | number>;
}

export const GRAPH_PRESETS: FormulaPreset[] = [
  { id: 'egg-crate', label: 'Egg crate', params: { formula: 'sin(x) * cos(z)' } },
  { id: 'ripple', label: 'Ripple', params: { formula: 'sin(2 * sqrt(x^2 + z^2)) / 2' } },
  { id: 'saddle', label: 'Saddle', params: { formula: '(x^2 - z^2) / 8' } },
  { id: 'bowl', label: 'Bowl (parabola)', params: { formula: '(x^2 + z^2) / 8' } },
  { id: 'mountain', label: 'Mountain', params: { formula: '3 * exp(-(x^2 + z^2) / 6)' } },
  { id: 'twist', label: 'Twist', params: { formula: 'sin(x * z / 4)' } },
];

export const PARAMETRIC_PRESETS: FormulaPreset[] = [
  {
    id: 'mobius',
    label: 'Möbius strip',
    params: {
      x: '(2 + v * cos(u / 2)) * cos(u)',
      y: 'v * sin(u / 2)',
      z: '(2 + v * cos(u / 2)) * sin(u)',
      uMin: '0',
      uMax: '2*pi',
      vMin: '-0.6',
      vMax: '0.6',
    },
  },
  {
    id: 'shell',
    label: 'Sea shell',
    params: {
      x: '2 * (1 - exp(u / (6*pi))) * cos(u) * cos(v/2)^2',
      y: '1 - exp(u / (3*pi)) - sin(v) + exp(u / (6*pi)) * sin(v)',
      z: '2 * (-1 + exp(u / (6*pi))) * sin(u) * cos(v/2)^2',
      uMin: '0',
      uMax: '6*pi',
      vMin: '0',
      vMax: '2*pi',
    },
  },
  {
    id: 'helicoid',
    label: 'Spiral ramp',
    params: { x: 'v * cos(u)', y: 'u / 3', z: 'v * sin(u)', uMin: '0', uMax: '4*pi', vMin: '0.3', vMax: '2' },
  },
  {
    id: 'torus',
    label: 'Torus',
    params: {
      x: '(2 + 0.7 * cos(v)) * cos(u)',
      y: '0.7 * sin(v)',
      z: '(2 + 0.7 * cos(v)) * sin(u)',
      uMin: '0',
      uMax: '2*pi',
      vMin: '0',
      vMax: '2*pi',
    },
  },
  {
    id: 'sphere',
    label: 'Sphere',
    params: {
      x: '2 * sin(v) * cos(u)',
      y: '2 * cos(v)',
      z: '2 * sin(v) * sin(u)',
      uMin: '0',
      uMax: '2*pi',
      vMin: '0',
      vMax: 'pi',
    },
  },
  {
    id: 'saddle',
    label: 'Saddle',
    params: { x: 'u', y: '(u^2 - v^2) / 4', z: 'v', uMin: '-3', uMax: '3', vMin: '-3', vMax: '3' },
  },
];

/** Signed area of a closed polygon (shoelace formula). Positive = counter-clockwise. */
export function signedArea(pts: Vec2[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}
