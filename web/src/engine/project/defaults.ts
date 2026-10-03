import { uid } from '../math';
import { defaultPattern, getPattern } from '../patterns/registry';
import { defaultShape } from '../shapes/registry';
import type {
  GroupNode,
  MaterialDef,
  ObjectNode,
  PatternNode,
  PatternType,
  Project,
  ShapeType,
  SourceRef,
  SymmetryDef,
  Transform,
  VariationDef,
} from '../types';
import { PROJECT_APP_ID, PROJECT_VERSION } from './schema';

export const PALETTE = [
  '#4c6ef5',
  '#f76707',
  '#37b24d',
  '#e64980',
  '#fab005',
  '#15aabf',
  '#7950f2',
  '#f03e3e',
];

export function defaultTransform(): Transform {
  return { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };
}

export function defaultMaterial(color = PALETTE[0]): MaterialDef {
  return { color, metalness: 0.1, roughness: 0.45, opacity: 1, wireframe: false, flatShading: false };
}

export function defaultSymmetry(): SymmetryDef {
  return { mirrorX: false, mirrorY: false, mirrorZ: false, radialCopies: 1 };
}

export function defaultVariation(): VariationDef {
  return {
    sizeFrom: 1,
    sizeTo: 1,
    sizeMode: 'ramp',
    spinStep: 0,
    objectRotation: [0, 0, 0],
    wobble: 0,
    followPattern: true,
    colorMode: 'gradient',
    colorFrom: '#4c6ef5',
    colorTo: '#e64980',
    jitter: 0,
  };
}

export function shapeSource(type: ShapeType): SourceRef {
  return { kind: 'shape', shape: defaultShape(type) };
}

export function createObjectNode(source: SourceRef, name: string, color?: string): ObjectNode {
  return {
    id: uid('obj'),
    kind: 'object',
    name,
    parentId: null,
    visible: true,
    transform: defaultTransform(),
    symmetry: defaultSymmetry(),
    source,
    material: defaultMaterial(color),
  };
}

export function createPatternNode(source: SourceRef, patternType: PatternType, name: string): PatternNode {
  const def = getPattern(patternType);
  return {
    id: uid('pat'),
    kind: 'pattern',
    name,
    parentId: null,
    visible: true,
    transform: defaultTransform(),
    symmetry: defaultSymmetry(),
    source,
    material: defaultMaterial(),
    pattern: defaultPattern(patternType),
    count: def.defaultCount,
    variation: defaultVariation(),
    seed: 1,
  };
}

export function createGroupNode(name: string): GroupNode {
  return {
    id: uid('grp'),
    kind: 'group',
    name,
    parentId: null,
    visible: true,
    transform: defaultTransform(),
    symmetry: defaultSymmetry(),
  };
}

export function emptyProject(name = 'My 3D artwork'): Project {
  return {
    app: PROJECT_APP_ID,
    version: PROJECT_VERSION,
    name,
    author: '',
    units: 'cm',
    background: '#f1f3f5',
    nodes: [],
    library: [],
    meshes: [],
  };
}

/**
 * The example from the project brief:
 * 100 objects → Spiral → Radius 20 → Rotation 30° → Scale 0.5–2
 */
export function specExampleNode(): PatternNode {
  const node = createPatternNode(shapeSource('sphere'), 'spiral', 'Spiral of spheres');
  node.count = 100;
  node.pattern.params = { ...node.pattern.params, radius: 20, angleStep: 30 };
  node.variation = { ...node.variation, sizeFrom: 0.5, sizeTo: 2 };
  return node;
}

export function starterProject(): Project {
  const p = emptyProject();
  p.nodes.push(specExampleNode());
  return p;
}
