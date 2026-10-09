import { gate } from '../account/limits';
import { countObjects } from '../engine/evaluate';
import { floorDrawing, polygonArea } from '../engine/drawing';
import { Box3, Matrix4 } from 'three';

import { describeCommand, type ParsedCommand } from '../engine/command/parser';
import { evaluateScene, TooManyObjectsError } from '../engine/evaluate';
import { getPattern } from '../engine/patterns/registry';
import {
  createObjectNode,
  createPatternNode,
  defaultMaterial,
  defaultVariation,
  PALETTE,
  shapeSource,
} from '../engine/project/defaults';
import { matrixToTransform } from '../engine/project/tree';
import { buildGeometry, defaultShape, getShape } from '../engine/shapes/registry';
import { transformToMatrix } from '../engine/three/transforms';
import type {
  CustomPart,
  ObjectNode,
  PatternNode,
  PatternType,
  Project,
  ShapeType,
  ShapeDef,
  SourceRef,
  Vec2,
} from '../engine/types';
import { asUndoStep, useProjectStore } from '../state/projectStore';
import { notifications } from './notify';
import { useUiStore } from '../state/uiStore';
import { viewportBridge } from '../viewport/bridge';
import { contentBounds } from '../viewport/bounds';

const store = () => useProjectStore.getState();

/** "Cuboid" → "Cuboids" (good enough for pattern names). */
function plural(name: string): string {
  return /[a-z]$/i.test(name) && !/s$/i.test(name) ? `${name}s` : name;
}
const ui = () => useUiStore.getState();

/** The size of a new object, so it can sit on the floor and beside other things. */
function sourceBounds(source: SourceRef): Box3 {
  const { meshes, library } = store().project;
  const parts =
    source.kind === 'shape'
      ? [{ shape: source.shape, matrix: new Matrix4() }]
      : (library.find((c) => c.id === source.customId)?.parts ?? []).map((p) => ({
          shape: p.shape,
          matrix: transformToMatrix(p.transform),
        }));
  const box = new Box3();
  for (const part of parts) {
    const g = buildGeometry(part.shape, { meshes });
    if (g.boundingBox) box.union(g.boundingBox.clone().applyMatrix4(part.matrix));
    g.dispose();
  }
  return box;
}

function nextColor(): string {
  const used = store().project.nodes.length;
  return PALETTE[used % PALETTE.length];
}

/** Put new objects next to what is already there, so they don't hide inside it. */
function freeSpotX(own: Box3): number {
  const content = viewportBridge.content;
  if (!content || store().project.nodes.length === 0) return 0;
  const box = contentBounds(content);
  if (box.isEmpty() || box.min.x > own.max.x + 1 || box.max.x < own.min.x - 1) return 0;
  return Math.ceil(box.max.x + 2 - own.min.x);
}

function placeNew(node: ObjectNode) {
  const own = sourceBounds(node.source);
  const x = own.isEmpty() ? 0 : freeSpotX(own);
  const lift = own.isEmpty() ? 0 : Number((-own.min.y).toFixed(3));
  node.transform.position = [x, lift, 0];
  store().addNode(node);
  ui().select(node.id);
  if (x !== 0) ui().requestFrame();
}

export function addShape(type: ShapeType) {
  placeNew(createObjectNode(shapeSource(type), getShape(type).label, nextColor()));
  ui().setInspectorTab('shape');
}

export function addCustomShape(customId: string) {
  const custom = store().project.library.find((c) => c.id === customId);
  if (!custom) return;
  placeNew(createObjectNode({ kind: 'custom', customId }, custom.name));
}

/**
 * Turn the selected object into a pattern of copies of itself, change the pattern of the
 * selected pattern, or start a new pattern of spheres.
 */
export function applyPattern(type: PatternType) {
  if (!gate({ kind: 'pattern', type })) return;
  const selected =
    ui().selectedIds.length === 1
      ? store().project.nodes.find((n) => n.id === ui().selectedIds[0])
      : undefined;
  const adding = selected?.kind === 'pattern' ? 0 : getPattern(type).defaultCount;
  if (!gate({ kind: 'objects', count: countObjects(store().project) + adding })) return;
  asUndoStep(() => applyPatternNow(type));
}

function applyPatternNow(type: PatternType) {
  const { selectedIds } = ui();
  const nodes = store().project.nodes;
  const selected = selectedIds.length === 1 ? nodes.find((n) => n.id === selectedIds[0]) : undefined;
  const def = getPattern(type);

  if (selected?.kind === 'pattern') {
    store().updateNode(selected.id, (n) => {
      if (n.kind !== 'pattern') return;
      n.pattern = { type, params: structuredClone(def.defaults) };
      n.count = def.defaultCount;
      n.name = n.name.replace(/^\S+ of /, `${def.label} of `);
    });
    ui().setInspectorTab('pattern');
    ui().requestFrame();
    return;
  }

  if (selected?.kind === 'object') {
    const pattern: PatternNode = {
      ...createPatternNode(selected.source, type, `${def.label} of ${plural(selected.name)}`),
      id: selected.id,
      parentId: selected.parentId,
      symmetry: selected.symmetry,
      material: selected.material,
      transform: { ...selected.transform, position: [0, 0, 0] },
      variation: { ...defaultVariation(), colorMode: 'single' },
    };
    store().updateNode(selected.id, (n) => {
      Object.assign(n, pattern);
    });
    ui().select(selected.id);
    ui().setInspectorTab('pattern');
    ui().requestFrame();
    return;
  }

  const node = createPatternNode(shapeSource('sphere'), type, `${def.label} of spheres`);
  store().addNode(node);
  ui().select(node.id);
  ui().setInspectorTab('pattern');
  ui().requestFrame();
}

export function deleteSelection() {
  const ids = ui().selectedIds;
  if (!ids.length) return;
  store().removeNodes(ids);
  ui().select(null);
}

export function duplicateSelection() {
  const ids = ui().selectedIds;
  if (!ids.length) return;
  ui().setSelection(store().duplicateNodes(ids));
}

export function groupSelection(): boolean {
  const id = store().groupNodes(ui().selectedIds);
  if (id) ui().select(id);
  return Boolean(id);
}

export function ungroupSelection() {
  const [id] = ui().selectedIds;
  if (!id) return;
  ui().setSelection(store().ungroup(id));
}

export function toggleVisible(id: string) {
  asUndoStep(() =>
    store().updateNode(id, (n) => {
      n.visible = !n.visible;
    }),
  );
}

export const MAX_CUSTOM_PARTS = 500;

/**
 * Save a node (usually a group) as a reusable custom shape. Everything inside is flattened
 * into simple parts, measured from the node's own center.
 */
export function saveAsCustomShape(nodeId: string, name: string): { ok: true } | { ok: false; error: string } {
  if (!gate({ kind: 'myShapes', count: store().project.library.length }))
    return { ok: false, error: 'Your plan has no room for more saved shapes.' };
  const project = store().project;
  const node = project.nodes.find((n) => n.id === nodeId);
  if (!node) return { ok: false, error: 'Nothing selected.' };
  // Parts are stored relative to the node itself, so undo its own placement first.
  const inverse = transformToMatrix(node.transform).invert();
  const parentless = {
    ...project,
    nodes: project.nodes.map((n) => (n.id === nodeId ? { ...n, parentId: null } : n)),
  };
  let items;
  try {
    items = evaluateScene(parentless, { rootIds: [nodeId], rootMatrix: inverse, maxItems: MAX_CUSTOM_PARTS });
  } catch (e) {
    if (e instanceof TooManyObjectsError)
      return {
        ok: false,
        error: `A custom shape can have at most ${MAX_CUSTOM_PARTS} parts. Use fewer objects.`,
      };
    throw e;
  }
  if (!items.length) return { ok: false, error: 'There is nothing to save inside this.' };
  const parts: CustomPart[] = items.map((it) => ({
    shape: structuredClone(it.shape),
    transform: matrixToTransform(it.matrix),
    material: { ...defaultMaterial(), ...it.material },
  }));
  store().addCustomShape({ name, parts });
  return { ok: true };
}

export function resetShapeSizes(nodeId: string) {
  store().updateNode(nodeId, (n) => {
    if (n.kind === 'group' || n.source.kind !== 'shape') return;
    n.source.shape = defaultShape(n.source.shape.type);
  });
}

/**
 * Make (or change) a pattern from a typed recipe.
 * - A selected pattern is changed, unless the recipe names a different shape.
 * - A selected object is turned into the pattern (unless the recipe names a shape).
 * - Otherwise a new pattern is added.
 */
export function applyCommand(cmd: ParsedCommand): string {
  const pattern = cmd.pattern ?? 'spiral';
  if (!gate({ kind: 'pattern', type: pattern }))
    return `nothing yet: the ${pattern} pattern is not in your plan`;
  const adding = cmd.count ?? getPattern(pattern).defaultCount;
  if (!gate({ kind: 'objects', count: countObjects(store().project) + adding }))
    return 'nothing yet: that would be too many objects for your plan';
  return asUndoStep(() => applyCommandNow(cmd));
}

function applyCommandNow(cmd: ParsedCommand): string {
  const { selectedIds } = ui();
  const nodes = store().project.nodes;
  const selected = selectedIds.length === 1 ? nodes.find((n) => n.id === selectedIds[0]) : undefined;
  const patternType = cmd.pattern ?? 'spiral';
  const def = getPattern(patternType);
  const newSource = (): SourceRef => {
    const src = shapeSource(cmd.shape ?? 'sphere');
    if (src.kind === 'shape' && cmd.shapeParams) Object.assign(src.shape.params, cmd.shapeParams);
    return src;
  };

  const patch = (n: PatternNode, freshPattern: boolean) => {
    if (cmd.pattern && (freshPattern || n.pattern.type !== cmd.pattern)) {
      n.pattern = { type: patternType, params: structuredClone(def.defaults) };
      n.count = def.defaultCount;
    }
    Object.assign(n.pattern.params, cmd.patternParams);
    if (cmd.count !== undefined) n.count = cmd.count;
    Object.assign(n.variation, cmd.variation);
    Object.assign(n.symmetry, cmd.symmetry);
    if (cmd.materialColor) n.material.color = cmd.materialColor;
    if (cmd.seed !== undefined) n.seed = cmd.seed;
  };

  if (selected?.kind === 'pattern' && !cmd.shape) {
    store().updateNode(selected.id, (n) => {
      if (n.kind === 'pattern') patch(n, false);
    });
    ui().requestFrame();
    return describeCommand(cmd);
  }

  const source = selected?.kind === 'object' && !cmd.shape ? selected.source : newSource();
  const shapeName = source.kind === 'shape' ? getShape(source.shape.type).label : 'my shapes';
  const node = createPatternNode(source, patternType, `${def.label} of ${plural(shapeName.toLowerCase())}`);
  patch(node, true);
  if (selected?.kind === 'object' && !cmd.shape) {
    node.id = selected.id;
    node.material = selected.material;
    node.parentId = selected.parentId;
    store().updateNode(selected.id, (n) => void Object.assign(n, node));
  } else {
    store().addNode(node);
  }
  ui().select(node.id);
  ui().setInspectorTab('pattern');
  ui().requestFrame();
  return describeCommand(cmd);
}

/** Replace the whole project (e.g. opening a file or an idea). Undo can bring the old one back. */
export function loadProject(project: Project) {
  store().setProject(project);
  ui().select(null);
  // an old cut would slice the new project in the wrong place
  ui().resetCut();
  ui().requestFrame();
}

/** Read a GLB/STL/OBJ file and add it to the scene as a group of shapes. */
export async function importModel(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext !== 'glb' && ext !== 'stl' && ext !== 'obj') {
    notifications.show({ color: 'red', message: 'Please choose a .glb, .stl or .obj file.' });
    return;
  }
  if (file.size > 60 * 1024 * 1024) {
    notifications.show({ color: 'red', message: 'That file is bigger than 60 MB. Try a simpler model.' });
    return;
  }
  try {
    const { parseModel, modelToNodes } = await import('../services/modelAssets');
    const name = file.name.replace(/\.[^.]+$/, '');
    const parts = await parseModel(await file.arrayBuffer(), ext, name);
    if (!parts.length) throw new Error('No triangles were found in the file.');
    const { group, nodes, meshes } = modelToNodes(parts, name, ext, store().project.units);
    asUndoStep(() =>
      store().updateProject((p) => {
        p.meshes.push(...meshes);
        p.nodes.push(group, ...nodes);
      }),
    );
    ui().select(group.id);
    ui().requestFrame();
    const kb = meshes.reduce((s, m) => s + m.positions.length + m.indices.length, 0) / 1024;
    notifications.show({
      color: kb > 3000 ? 'orange' : 'green',
      message:
        `Imported ${parts.length} part${parts.length === 1 ? '' : 's'} from ${file.name}.` +
        (kb > 3000 ? ' It is large, so autosave may not fit it: use File → Save project file.' : ''),
    });
  } catch (e) {
    notifications.show({
      color: 'red',
      title: 'Import failed',
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

/** Open the real human heart (Human Reference Atlas) with its standard cutting planes. */
export async function openHeart() {
  const { buildHeartProject } = await import('../services/modelAssets');
  const project = await buildHeartProject();
  loadProject(project);
}

/**
 * Turn a pencil line drawn on the floor into a shape: a solid (the outline, pushed up) or a
 * 3D pen tube that follows the line. Returns a message for the student.
 */
export function addDrawing(floor: Vec2[], make: 'solid' | 'tube', thickness: number, width: number): string {
  const drawing = floorDrawing(floor, 0.06);
  if (!drawing) return 'Draw a longer line.';
  const { points, centre, loop } = drawing;
  const solid = make === 'solid';
  if (solid && (points.length < 3 || polygonArea(points) < 0.05)) {
    return 'Draw a shape with some space inside it (a loop), or choose Tube.';
  }
  const radius = Math.max(0.02, width / 2);
  const shape: ShapeDef = solid
    ? { type: 'extrude', params: { outline: points, depth: thickness, bevel: false, bevelSize: 0.1 } }
    : { type: 'tube', params: { path: points, radius, smooth: true, closed: loop } };
  const node = createObjectNode({ kind: 'shape', shape }, solid ? 'Drawn shape' : 'Pen line', nextColor());
  node.transform.position = [centre.x, solid ? thickness / 2 : radius, centre.z];
  node.transform.rotation = [-90, 0, 0];
  store().addNode(node);
  ui().select(node.id);
  ui().setInspectorTab('shape');
  return solid
    ? `Made a solid from your outline (${points.length} corners).`
    : `Made a ${loop ? 'loop' : 'tube'} from your line.`;
}
