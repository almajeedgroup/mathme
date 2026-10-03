import { GizmoHelper, GizmoViewport, Grid, OrbitControls, TransformControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { type Box3, type Group, PerspectiveCamera, Sphere, type Vector3 } from 'three';
import { DEG, radToDeg } from '../engine/math';
import { useProjectStore } from '../state/projectStore';
import { useUiStore } from '../state/uiStore';
import { contentBounds } from './bounds';
import { viewportBridge } from './bridge';
import { SceneContent } from './SceneContent';

export function Viewport() {
  const background = useProjectStore((s) => s.project.background);
  const select = useUiStore((s) => s.select);
  const contentRef = useRef<Group>(null);

  return (
    <Canvas
      data-testid="viewport"
      camera={{ position: [32, 26, 32], fov: 45, near: 0.1, far: 5000 }}
      frameloop="demand"
      dpr={[1, 2]}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      onPointerMissed={(e) => {
        if (e.button === 0) select(null);
      }}
    >
      <color attach="background" args={[background]} />
      <Lights />
      <group name="content" ref={contentRef}>
        <SceneContent />
      </group>
      <Grid
        args={[400, 400]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#adb5bd"
        sectionSize={10}
        sectionThickness={1.1}
        sectionColor="#748ffc"
        fadeDistance={260}
        fadeStrength={1.5}
        infiniteGrid
        raycast={() => null}
      />
      <SelectionGizmo />
      <SelectionOutline />
      <OrbitControls makeDefault enableDamping={false} />
      <GizmoHelper alignment="bottom-right" margin={[72, 72]}>
        <GizmoViewport axisColors={['#fa5252', '#40c057', '#4c6ef5']} labelColor="white" />
      </GizmoHelper>
      <CameraFramer contentRef={contentRef} />
      <Bridge contentRef={contentRef} />
    </Canvas>
  );
}

function Lights() {
  return (
    <group name="lights">
      <hemisphereLight args={['#ffffff', '#9aa5b1', 1.1]} />
      <directionalLight position={[30, 50, 25]} intensity={2.2} />
      <directionalLight position={[-30, 20, -20]} intensity={0.7} />
      <ambientLight intensity={0.25} />
    </group>
  );
}

const r3 = (v: number) => Number(v.toFixed(3));

function SelectionGizmo() {
  const id = useUiStore((s) => (s.selectedIds.length === 1 ? s.selectedIds[0] : null));
  const obj = useUiStore((s) => (id ? s.nodeObjects[id] : undefined));
  const mode = useUiStore((s) => s.transformMode);
  const snap = useUiStore((s) => s.snap);
  const updateNode = useProjectStore((s) => s.updateNode);
  if (!id || !obj) return null;
  return (
    <TransformControls
      object={obj}
      mode={mode}
      size={0.9}
      translationSnap={snap ? 0.5 : null}
      rotationSnap={snap ? 15 * DEG : null}
      scaleSnap={snap ? 0.1 : null}
      onObjectChange={() =>
        updateNode(id, (n) => {
          n.transform.position = [r3(obj.position.x), r3(obj.position.y), r3(obj.position.z)];
          n.transform.rotation = [
            r3(radToDeg(obj.rotation.x)),
            r3(radToDeg(obj.rotation.y)),
            r3(radToDeg(obj.rotation.z)),
          ];
          n.transform.scale = [r3(obj.scale.x), r3(obj.scale.y), r3(obj.scale.z)];
        })
      }
    />
  );
}

/** An orange box around each selected thing (keeps the real colours visible). */
function SelectionOutline() {
  const ids = useUiStore((s) => s.selectedIds);
  const objects = useUiStore((s) => s.nodeObjects);
  const nodes = useProjectStore((s) => s.project.nodes);
  const invalidate = useThree((s) => s.invalidate);
  const [boxes, setBoxes] = useState<Box3[]>([]);
  useEffect(() => {
    // wait a frame so pattern instance matrices are up to date
    const handle = requestAnimationFrame(() => {
      setBoxes(
        ids
          .map((id) => objects[id])
          .filter((o): o is NonNullable<typeof o> => Boolean(o))
          .map((o) => contentBounds(o))
          .filter((b) => !b.isEmpty()),
      );
      invalidate();
    });
    return () => cancelAnimationFrame(handle);
  }, [ids, objects, nodes, invalidate]);
  return (
    <>
      {boxes.map((b, i) => (
        <box3Helper key={i} args={[b, '#f76707']} raycast={() => null} />
      ))}
    </>
  );
}

function CameraFramer({ contentRef }: { contentRef: React.RefObject<Group | null> }) {
  const frameRequest = useUiStore((s) => s.frameRequest);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { target: Vector3; update(): void } | null;
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    const content = contentRef.current;
    if (!content || !controls || !(camera instanceof PerspectiveCamera)) return;
    // wait a frame so newly added objects have their instance matrices
    const handle = requestAnimationFrame(() => {
      const box = contentBounds(content);
      if (box.isEmpty()) return;
      const sphere = box.getBoundingSphere(new Sphere());
      const radius = Math.max(sphere.radius, 1);
      const dist = (radius / Math.sin((camera.fov * DEG) / 2)) * 1.05;
      const dir = camera.position.clone().sub(controls.target);
      if (dir.lengthSq() < 1e-9) dir.set(1, 0.8, 1);
      dir.normalize();
      camera.position.copy(sphere.center).addScaledVector(dir, dist);
      camera.near = Math.max(0.01, dist / 200);
      camera.far = dist * 50;
      camera.updateProjectionMatrix();
      controls.target.copy(sphere.center);
      controls.update();
      invalidate();
    });
    return () => cancelAnimationFrame(handle);
  }, [frameRequest, camera, controls, contentRef, invalidate]);
  return null;
}

function Bridge({ contentRef }: { contentRef: React.RefObject<Group | null> }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    viewportBridge.gl = gl;
    viewportBridge.camera = camera;
    viewportBridge.content = contentRef.current;
    viewportBridge.invalidate = invalidate;
  }, [gl, camera, contentRef, invalidate]);
  return null;
}
