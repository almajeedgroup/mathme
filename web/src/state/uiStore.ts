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

/** Settings that are remembered in this browser. */
export interface Prefs {
  /** Left sidebar shrunk to a strip of icons (wide screens). */
  navCollapsed: boolean;
  /** Right details panel hidden (wide screens). */
  asideHidden: boolean;
  showGrid: boolean;
  showAxes: boolean;
  /** Which sidebar sections are open. */
  sections: { shapes: boolean; patterns: boolean; scene: boolean };
}

const PREFS_KEY = 'mathme.prefs.v1';

export const DEFAULT_PREFS: Prefs = {
  navCollapsed: false,
  asideHidden: false,
  showGrid: true,
  showAxes: true,
  sections: { shapes: true, patterns: true, scene: true },
};

function loadPrefs(): Prefs {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<Prefs>;
    return { ...DEFAULT_PREFS, ...saved, sections: { ...DEFAULT_PREFS.sections, ...saved.sections } };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* private mode: just don't remember */
  }
}

/** The pencil: what it draws and what the drawing becomes. */
export interface DrawState {
  /** null = not drawing; pencil = freehand; lines = click corner to corner. */
  tool: 'pencil' | 'lines' | null;
  /** solid = fill the outline and give it thickness; tube = a 3D pen line. */
  make: 'solid' | 'tube';
  /** Thickness of a solid / width of a tube, in project units. */
  thickness: number;
  width: number;
}

interface UiState {
  draw: DrawState;
  setDraw(patch: Partial<DrawState>): void;
  /** The project list (home) or the 3D studio. */
  view: 'home' | 'studio';
  /** Inside the studio: the 3D view or the 2D sketch board. */
  studioMode: '3d' | '2d';
  /** The id of the open project in the project list. */
  currentProjectId: string | null;
  prefs: Prefs;
  settingsOpen: boolean;
  /** Bumped to show the welcome tour again. */
  tourRequest: number;
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
  /** The geometry service can reach an AI model for the chat box. */
  assistantOnline: boolean;
  /** The claude.ai artifact viewer lets this page ask Claude (see services/claudeSample.ts). */
  claudeChat: boolean;
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
  setOpen(
    panel: 'exportOpen' | 'presetsOpen' | 'helpOpen' | 'navOpen' | 'asideOpen' | 'settingsOpen',
    open: boolean,
  ): void;
  setPrefs(patch: Partial<Prefs>): void;
  toggleSection(section: keyof Prefs['sections'], open?: boolean): void;
  showTour(): void;
  setServiceOnline(online: boolean): void;
  registerObject(id: string, obj: Object3D | null): void;
  requestFrame(): void;
  setCut(patch: Partial<CutState>): void;
  /** Switch the cut off and close its panel (a cut belongs to the model it was made for). */
  resetCut(): void;
  setCutOpen(open: boolean): void;
  lookAlong(dir: [number, number, number], plane?: { n: [number, number, number]; d: number }): void;
}

const NO_CUT: CutState = {
  mode: 'off',
  tilt: 0,
  turn: 0,
  shift: 0,
  centre: [0, 0, 0],
  size: 20,
  presetId: null,
};

export const useUiStore = create<UiState>()((set) => ({
  draw: { tool: null, make: 'solid', thickness: 1, width: 0.4 },
  setDraw: (patch) => set((s) => ({ draw: { ...s.draw, ...patch } })),
  view: 'home',
  studioMode: '3d',
  currentProjectId: null,
  prefs: loadPrefs(),
  settingsOpen: false,
  tourRequest: 0,
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
  assistantOnline: false,
  claudeChat: false,
  nodeObjects: {},
  frameRequest: 0,
  cutOpen: false,
  lookRequest: null,
  cut: NO_CUT,

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
  setPrefs: (patch) =>
    set((s) => {
      const prefs = { ...s.prefs, ...patch };
      savePrefs(prefs);
      return { prefs };
    }),
  toggleSection: (section, open) =>
    set((s) => {
      const sections = { ...s.prefs.sections, [section]: open ?? !s.prefs.sections[section] };
      const prefs = { ...s.prefs, sections };
      savePrefs(prefs);
      return { prefs };
    }),
  showTour: () => set((s) => ({ tourRequest: s.tourRequest + 1 })),
  resetCut: () => set({ cut: NO_CUT, cutOpen: false }),
  lookAlong: (dir, plane) =>
    set((s) => ({ lookRequest: { dir, plane, nonce: (s.lookRequest?.nonce ?? 0) + 1 } })),
}));
