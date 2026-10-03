import { fmt } from '../math';
import type { Sketch, SketchCircle, SketchLine, SketchPoint, Vec2 } from '../types';
import { angleBetween, lineAngle, lineEnds, lineLength, perimeter, pointMap, signedArea } from './geometry';

/** One line of "show your working" for the 2D sketch. */
export interface SketchFormula {
  quantity: string;
  formula: string;
  working: string;
  value: number;
  /** length → units; area → units²; degrees → °. */
  kind: 'length' | 'area' | 'degrees';
}

export function withUnit(f: SketchFormula, units: string): string {
  if (f.kind === 'degrees') return `${fmt(f.value, 1)}°`;
  return `${fmt(f.value)} ${units}${f.kind === 'area' ? '²' : ''}`;
}

export function pointFormulas(p: SketchPoint): SketchFormula[] {
  return [
    {
      quantity: 'Distance from the origin',
      formula: 'd = √(x² + y²)',
      working: `d = √(${fmt(p.x)}² + ${fmt(p.y)}²)`,
      value: Math.hypot(p.x, p.y),
      kind: 'length',
    },
  ];
}

export function lineFormulas(sketch: Sketch, line: SketchLine): SketchFormula[] {
  const ends = lineEnds(sketch, line);
  if (!ends) return [];
  const [a, b] = ends;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return [
    {
      quantity: 'Length',
      formula: 'L = √(Δx² + Δy²)   (Pythagoras)',
      working: `L = √(${fmt(dx)}² + ${fmt(dy)}²)`,
      value: lineLength(a, b),
      kind: 'length',
    },
    {
      quantity: 'Angle from horizontal',
      formula: 'θ = tan⁻¹(Δy ÷ Δx)',
      working: `θ = tan⁻¹(${fmt(dy)} ÷ ${fmt(dx)})`,
      value: lineAngle(a, b) % 180,
      kind: 'degrees',
    },
    {
      quantity: 'Midpoint',
      formula: 'M = ((x₁ + x₂) ÷ 2, (y₁ + y₂) ÷ 2)',
      working: `M = (${fmt((a.x + b.x) / 2)}, ${fmt((a.y + b.y) / 2)})`,
      value: NaN,
      kind: 'length',
    },
  ];
}

export function circleFormulas(circle: SketchCircle): SketchFormula[] {
  const r = circle.r;
  return [
    {
      quantity: 'Diameter',
      formula: 'd = 2 × r',
      working: `d = 2 × ${fmt(r)}`,
      value: 2 * r,
      kind: 'length',
    },
    {
      quantity: 'Circumference',
      formula: 'C = 2 × π × r',
      working: `C = 2 × π × ${fmt(r)}`,
      value: 2 * Math.PI * r,
      kind: 'length',
    },
    {
      quantity: 'Area',
      formula: 'A = π × r²',
      working: `A = π × ${fmt(r)}²`,
      value: Math.PI * r * r,
      kind: 'area',
    },
  ];
}

export function angleFormulas(sketch: Sketch, l1: SketchLine, l2: SketchLine): SketchFormula[] {
  const { degrees, corner } = angleBetween(sketch, l1, l2);
  return [
    {
      quantity: corner ? 'Angle at the shared corner' : 'Angle between the lines',
      formula: 'θ = cos⁻¹((u · v) ÷ (|u| × |v|))',
      working: corner ? 'u and v run from the shared corner along each line' : 'u and v run along each line',
      value: degrees,
      kind: 'degrees',
    },
  ];
}

export function loopFormulas(poly: Vec2[]): SketchFormula[] {
  const n = poly.length;
  const area = Math.abs(signedArea(poly));
  const per = perimeter(poly);
  return [
    {
      quantity: 'Perimeter',
      formula: 'P = the sum of the side lengths',
      working: `${n} sides added up`,
      value: per,
      kind: 'length',
    },
    {
      quantity: 'Area',
      formula: 'A = ½ × |Σ (xᵢ × yᵢ₊₁ − xᵢ₊₁ × yᵢ)|   (shoelace formula)',
      working: `${n} corners: ${poly.map(([x, y]) => `(${fmt(x)}, ${fmt(y)})`).join(', ')}`,
      value: area,
      kind: 'area',
    },
    {
      quantity: 'Inside angles add up to',
      formula: 'S = (n − 2) × 180°',
      working: `S = (${n} − 2) × 180°`,
      value: (n - 2) * 180,
      kind: 'degrees',
    },
  ];
}

/** Sizes of everything, for the PDF sheet and the summary. */
export function sketchSummary(sketch: Sketch): { label: string; value: string }[] {
  const byId = pointMap(sketch);
  const rows: { label: string; value: string }[] = [];
  sketch.lines.forEach((l, i) => {
    const a = byId.get(l.a);
    const b = byId.get(l.b);
    if (a && b) rows.push({ label: `Line ${i + 1}`, value: `L = ${fmt(lineLength(a, b))}` });
  });
  sketch.circles.forEach((c, i) =>
    rows.push({ label: `Circle ${i + 1}`, value: `r = ${fmt(c.r)}, A = ${fmt(Math.PI * c.r * c.r)}` }),
  );
  return rows;
}
