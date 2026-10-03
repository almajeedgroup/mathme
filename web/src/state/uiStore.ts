import type { Object3D } from 'three';
import { create } from 'zustand';

export type TransformMode = 'translate' | 'rotate' | 'scale';

/** off = no cut; a = keep the half the plane's normal points to; b = keep the other half. */
export type CutMode = 'off' | 'a' | 'b';

export interface CutState {
  mode: CutMode;
  tilt: number;
  turn: number;
  shift: number;
  centre: [number, number, number];
  /** size of the model, for the sliders and the plane sheet */
  size: number;
  presetId: string | null;
}

interface UiState {
  selectedIds: string[];
  /** The object inside a pattern that was clicked (used by the Learn panel). */
  selectedInstance: { nodeId: string; index: number } | null;
  transformMode: TransformMode;
  snap: boolean;
  inspectorTab: string | null;
  exportOpen: boolean;
  presetsOpen: boolean;
  helpOpen: boolean;
  navOpen: boolean;
  asideOpen: boolean;
  serviceOnline: boolean | null;
  /** Three.js objects for each node (copy 0), so the move/rotate/scale gizmo can grab them. */
  nodeObjects: Record<string, Object3D>;
  /** Bumped to ask the viewport to fit everything in view. */
  frameRequest: number;
  cutOpen: boolean;
  cut: CutState;
  /** Ask the camera to look along a direction (e.g. straight at the cut face). */
  lookRequest: {
    dir: [number, number, number];
    nonce: number;
    plane?: { n: [number, number, number]; d: number };
  } | null;

  select(id: string | null, opts?: { additive?: boolean; instance?: number }): void;
  setSelection(ids: string[]): void;
  setTransformMode(mode: TransformMode): void;
  setSnap(snap: boolean): void;
  setInspectorTab(tab: string | null): void;
  setOpen(panel: 'exportOpen' | 'presetsOpen' | 'helpOpen' | 'navOpen' | 'asideOpen', open: boolean): void;
  setServiceOnline(online: boolean): void;
  registerObject(id: string, obj: Object3D | null): void;
  requestFrame(): void;
  setCut(patch: Partial<CutState>): void;
  setCutOpen(open: boolean): void;
  lookAlong(dir: [number, number, number], plane?: { n: [number, number, number]; d: number }): void;
}

export const useUiStore = create<UiState>()((set) => ({
  selectedIds: [],
  selectedInstance: null,
  transformMode: 'translate',
  snap: true,
  inspectorTab: null,
  exportOpen: false,
  presetsOpen: false,
  helpOpen: false,
  navOpen: false,
  asideOpen: false,
  serviceOnline: null,
  nodeObjects: {},
  frameRequest: 0,
  cutOpen: false,
  lookRequest: null,
  cut: { mode: 'off', tilt: 0, turn: 0, shift: 0, centre: [0, 0, 0], size: 20, presetId: null },

  select: (id, opts = {}) =>
    set((s) => {
      if (id === null) return { selectedIds: [], selectedInstance: null };
      const instance = opts.instance !== undefined ? { nodeId: id, index: opts.instance } : null;
      if (opts.additive) {
        const has = s.selectedIds.includes(id);
        return {
          selectedIds: has ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id],
          selectedInstance: instance,
        };
      }
      return { selectedIds: [id], selectedInstance: instance };
    }),
  setSelection: (ids) => set({ selectedIds: ids, selectedInstance: null }),
  setTransformMode: (transformMode) => set({ transformMode }),
  setSnap: (snap) => set({ snap }),
  setInspectorTab: (inspectorTab) => set({ inspectorTab }),
  setOpen: (panel, open) => set({ [panel]: open } as Partial<UiState>),
  setServiceOnline: (serviceOnline) => set({ serviceOnline }),
  registerObject: (id, obj) =>
    set((s) => {
      if (obj === null) {
        if (!(id in s.nodeObjects)) return s;
        const rest = { ...s.nodeObjects };
        delete rest[id];
        return { nodeObjects: rest };
      }
      if (s.nodeObjects[id] === obj) return s;
      return { nodeObjects: { ...s.nodeObjects, [id]: obj } };
    }),
  requestFrame: () => set((s) => ({ frameRequest: s.frameRequest + 1 })),
  setCut: (patch) => set((s) => ({ cut: { ...s.cut, ...patch } })),
  setCutOpen: (cutOpen) => set({ cutOpen }),
  lookAlong: (dir, plane) =>
    set((s) => ({ lookRequest: { dir, plane, nonce: (s.lookRequest?.nonce ?? 0) + 1 } })),
}));
