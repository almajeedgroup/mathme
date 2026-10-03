import { create } from 'zustand';

export type SketchTool = 'select' | 'point' | 'line' | 'circle' | 'pan';

/** A closed shape picked by clicking inside it. */
export type ShapeSelection =
  { kind: 'loop'; points: string[]; lines: string[] } | { kind: 'circle'; id: string };

interface SketchUi {
  tool: SketchTool;
  /** Selected point, line and circle ids. */
  selection: string[];
  shape: ShapeSelection | null;
  snapOn: boolean;
  showMeasures: boolean;
  /** Rules the solver could not meet, shown in red. */
  unmet: string[];
  /** The point the line tool continues from. */
  chainFrom: string | null;
  /** Where the current chain of lines began (clicking it again closes the shape). */
  chainStart: string | null;
  /** The centre the circle tool is waiting to size. */
  circleCentre: string | null;
  /** The view: the sketch point at the middle of the board, and pixels per unit. */
  view: { cx: number; cy: number; scale: number };
  set(patch: Partial<Omit<SketchUi, 'set'>>): void;
}

export const useSketchUi = create<SketchUi>((set) => ({
  tool: 'line',
  selection: [],
  shape: null,
  snapOn: true,
  showMeasures: true,
  unmet: [],
  chainFrom: null,
  chainStart: null,
  circleCentre: null,
  view: { cx: 0, cy: 0, scale: 40 },
  set: (patch) => set(patch),
}));
