import type { ThreeEvent } from '@react-three/fiber';
import { useThree } from '@react-three/fiber';
import { createContext, memo, useCallback, useContext, useLayoutEffect, useMemo, useRef } from 'react';
import { Color, DoubleSide, FrontSide, InstancedMesh, Matrix4, type Object3D } from 'three';

import { DEG } from '../engine/math';
import { layoutPattern, type PatternLayout } from '../engine/layout';
import { isOpenShape } from '../engine/shapes/registry';
import { symmetryMatrices, transformToMatrix } from '../engine/three/transforms';
import type {
  CustomShape,
  MaterialDef,
  ObjectNode,
  PatternNode,
  SceneNode,
  ShapeDef,
  SourceRef,
  StoredMesh,
  Transform,
} from '../engine/types';
import { useProjectStore } from '../state/projectStore';
import { useUiStore } from '../state/uiStore';
import { useShapeGeometry } from './useShapeGeometry';

interface SceneData {
  byParent: Map<string | null, SceneNode[]>;
  library: CustomShape[];
  meshes: StoredMesh[];
}

const SceneDataContext = createContext<SceneData>({ byParent: new Map(), library: [], meshes: [] });

interface Part {
  shape: ShapeDef;
  matrix: Matrix4 | null;
  material: MaterialDef;
}

/** The shapes a node draws: one for a plain shape, several for a custom (grouped) shape. */
function resolveParts(source: SourceRef, material: MaterialDef, library: CustomShape[]): Part[] {
  if (source.kind === 'shape') return [{ shape: source.shape, matrix: null, material }];
  const custom = library.find((c) => c.id === source.customId);
  if (!custom) return [];
  return custom.parts.map((p) => ({
    shape: p.shape,
    matrix: transformToMatrix(p.transform),
    material: p.material,
  }));
}

export function SceneContent() {
  const nodes = useProjectStore((s) => s.project.nodes);
  const library = useProjectStore((s) => s.project.library);
  const meshes = useProjectStore((s) => s.project.meshes);
  const data = useMemo<SceneData>(() => {
    const byParent = new Map<string | null, SceneNode[]>();
    for (const n of nodes) {
      const list = byParent.get(n.parentId) ?? [];
      list.push(n);
      byParent.set(n.parentId, list);
    }
    return { byParent, library, meshes };
  }, [nodes, library, meshes]);

  return (
    <SceneDataContext.Provider value={data}>
      {(data.byParent.get(null) ?? []).map((n) => (
        <NodeView key={n.id} node={n} selectId={n.id} />
      ))}
    </SceneDataContext.Provider>
  );
}

function useNodeClick(selectId: string) {
  const select = useUiStore((s) => s.select);
  return useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (e.delta > 4) return; // that was a drag to turn the camera, not a click
      e.stopPropagation();
      const instance =
        e.instanceId !== undefined && e.object instanceof InstancedMesh ? e.instanceId : undefined;
      select(selectId, { additive: e.shiftKey || e.ctrlKey || e.metaKey, instance });
    },
    [select, selectId],
  );
}

const NodeView = memo(function NodeView({ node, selectId }: { node: SceneNode; selectId: string }) {
  const copies = useMemo(() => symmetryMatrices(node.symmetry), [node.symmetry]);
  const registerObject = useUiStore((s) => s.registerObject);
  const ref = useCallback((obj: Object3D | null) => registerObject(node.id, obj), [registerObject, node.id]);
  if (!node.visible) return null;
  return (
    <>
      {copies.map((m, k) => (
        <group key={k} matrix={m} matrixAutoUpdate={false}>
          <TransformGroup transform={node.transform} objRef={k === 0 ? ref : undefined} nodeId={node.id}>
            <NodeBody node={node} selectId={selectId} />
          </TransformGroup>
        </group>
      ))}
    </>
  );
});

function TransformGroup({
  transform,
  objRef,
  nodeId,
  children,
}: {
  transform: Transform;
  objRef?: (o: Object3D | null) => void;
  nodeId: string;
  children: React.ReactNode;
}) {
  const [rx, ry, rz] = transform.rotation;
  return (
    <group
      ref={objRef}
      position={transform.position}
      rotation={[rx * DEG, ry * DEG, rz * DEG]}
      scale={transform.scale}
      userData={{ nodeId }}
    >
      {children}
    </group>
  );
}

function NodeBody({ node, selectId }: { node: SceneNode; selectId: string }) {
  const data = useContext(SceneDataContext);
  if (node.kind === 'group') {
    return (
      <>
        {(data.byParent.get(node.id) ?? []).map((c) => (
          <NodeView key={c.id} node={c} selectId={selectId} />
        ))}
      </>
    );
  }
  if (node.kind === 'object') return <ObjectBody node={node} selectId={selectId} />;
  return <PatternBody node={node} selectId={selectId} />;
}

function NodeMaterial({
  material,
  open,
  instanceColors,
}: {
  material: MaterialDef;
  open: boolean;
  instanceColors?: boolean;
}) {
  return (
    <meshStandardMaterial
      key={`${material.flatShading}-${open}`}
      color={instanceColors ? '#ffffff' : material.color}
      metalness={material.metalness}
      roughness={material.roughness}
      transparent={material.opacity < 1}
      opacity={material.opacity}
      depthWrite={material.opacity >= 1}
      wireframe={material.wireframe}
      flatShading={material.flatShading}
      side={open ? DoubleSide : FrontSide}
    />
  );
}

function ObjectBody({ node, selectId }: { node: ObjectNode; selectId: string }) {
  const { library } = useContext(SceneDataContext);
  const parts = useMemo(
    () => resolveParts(node.source, node.material, library),
    [node.source, node.material, library],
  );
  const onClick = useNodeClick(selectId);
  return (
    <>
      {parts.map((part, i) => (
        <PartMesh key={i} part={part} onClick={onClick} />
      ))}
    </>
  );
}

function PartMesh({ part, onClick }: { part: Part; onClick: (e: ThreeEvent<MouseEvent>) => void }) {
  const { meshes } = useContext(SceneDataContext);
  const geometry = useShapeGeometry(part.shape, meshes);
  const open = isOpenShape(part.shape);
  const mesh = (
    <mesh geometry={geometry} onClick={onClick}>
      <NodeMaterial material={part.material} open={open} />
    </mesh>
  );
  if (!part.matrix) return mesh;
  return (
    <group matrix={part.matrix} matrixAutoUpdate={false}>
      {mesh}
    </group>
  );
}

function PatternBody({ node, selectId }: { node: PatternNode; selectId: string }) {
  const { library } = useContext(SceneDataContext);
  const layout = useMemo(
    () => layoutPattern(node),
    // the layout only depends on these parts of the node
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [node.pattern, node.count, node.variation, node.seed],
  );
  const parts = useMemo(
    () => resolveParts(node.source, node.material, library),
    [node.source, node.material, library],
  );
  const onClick = useNodeClick(selectId);
  return (
    <>
      {parts.map((part, i) => (
        <PatternInstances key={i} part={part} layout={layout} onClick={onClick} />
      ))}
    </>
  );
}

function PatternInstances({
  part,
  layout,
  onClick,
}: {
  part: Part;
  layout: PatternLayout;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const { meshes } = useContext(SceneDataContext);
  const geometry = useShapeGeometry(part.shape, meshes);
  const ref = useRef<InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const hasColors = layout.colors !== null;

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new Matrix4();
    const c = new Color();
    for (let i = 0; i < layout.count; i++) {
      m.fromArray(layout.matrices, i * 16);
      if (part.matrix) m.multiply(part.matrix);
      mesh.setMatrixAt(i, m);
      if (layout.colors) mesh.setColorAt(i, c.fromArray(layout.colors, i * 3));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.computeBoundingBox();
    invalidate();
  }, [layout, part.matrix, geometry, invalidate]);

  if (layout.count === 0) return null;
  return (
    <instancedMesh
      key={`${geometry.uuid}-${layout.count}-${hasColors}`}
      ref={ref}
      args={[geometry, undefined, layout.count]}
      onClick={onClick}
      userData={{ instanced: true }}
    >
      <NodeMaterial material={part.material} open={isOpenShape(part.shape)} instanceColors={hasColors} />
    </instancedMesh>
  );
}
