import { Line } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { Plane, Raycaster, Vector2, Vector3 } from 'three';

import type { Vec2 } from '../engine/types';
import { useUiStore } from '../state/uiStore';
import { addDrawing } from '../ui/actions';
import { notifications } from '../ui/notify';

const FLOOR = new Plane(new Vector3(0, 1, 0), 0);
const MIN_STEP = 0.04;
const CLOSE_DISTANCE = 0.45;

/**
 * The pencil. While it is on, pointer strokes on the 3D view draw on the floor instead of turning
 * the camera or picking objects. Pencil = freehand; Lines = click corner to corner.
 */
export function DrawLayer() {
  const tool = useUiStore((s) => s.draw.tool);
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null;
  const invalidate = useThree((s) => s.invalidate);
  const [points, setPoints] = useState<Vec2[]>([]);
  const [hover, setHover] = useState<Vec2 | null>(null);
  const pointsRef = useRef<Vec2[]>([]);
  const down = useRef(false);

  const update = (next: Vec2[]) => {
    pointsRef.current = next;
    setPoints(next);
    invalidate();
  };

  // the camera stays still while drawing
  useEffect(() => {
    if (!controls) return;
    controls.enabled = !tool;
    if (tool) useUiStore.getState().select(null);
    return () => {
      controls.enabled = true;
    };
  }, [tool, controls]);

  useEffect(() => {
    if (!tool) {
      update([]);
      setHover(null);
      return;
    }
    const el = gl.domElement;
    const raycaster = new Raycaster();
    const ndc = new Vector2();
    const hit = new Vector3();

    const floorPoint = (e: PointerEvent | MouseEvent): Vec2 | null => {
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      if (!raycaster.ray.intersectPlane(FLOOR, hit)) return null;
      if (useUiStore.getState().snap && useUiStore.getState().draw.tool === 'lines') {
        return [Math.round(hit.x * 2) / 2, Math.round(hit.z * 2) / 2];
      }
      return [hit.x, hit.z];
    };

    const finish = () => {
      const pts = pointsRef.current;
      update([]);
      if (pts.length < 2) return;
      const { make, thickness, width } = useUiStore.getState().draw;
      notifications.show({ color: 'violet', message: addDrawing(pts, make, thickness, width) });
    };

    // stop the 3D view's own click handling (selecting, the move gizmo) while drawing
    const block = (e: Event) => e.stopPropagation();

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      block(e);
      const p = floorPoint(e);
      if (!p) return;
      const mode = useUiStore.getState().draw.tool;
      if (mode === 'pencil') {
        down.current = true;
        el.setPointerCapture(e.pointerId);
        update([p]);
        return;
      }
      // lines: clicking near the first corner closes the shape
      const pts = pointsRef.current;
      if (pts.length >= 3 && Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]) < CLOSE_DISTANCE) {
        update([...pts, pts[0]]);
        finish();
        return;
      }
      update([...pts, p]);
    };
    const onMove = (e: PointerEvent) => {
      const p = floorPoint(e);
      if (!p) return;
      if (useUiStore.getState().draw.tool === 'pencil') {
        if (!down.current) return;
        block(e);
        const pts = pointsRef.current;
        const last = pts[pts.length - 1];
        if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > MIN_STEP) update([...pts, p]);
      } else {
        setHover(p);
        invalidate();
      }
    };
    const onUp = (e: PointerEvent) => {
      block(e);
      if (useUiStore.getState().draw.tool === 'pencil' && down.current) {
        down.current = false;
        finish();
      }
    };
    const onDouble = (e: MouseEvent) => {
      block(e);
      if (useUiStore.getState().draw.tool === 'lines') finish();
    };
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (e.key === 'Enter') finish();
      else if (e.key === 'Backspace') update(pointsRef.current.slice(0, -1));
      else if (e.key === 'Escape') {
        if (pointsRef.current.length) update([]);
        else useUiStore.getState().setDraw({ tool: null });
      }
    };

    el.style.cursor = 'crosshair';
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('click', block);
    el.addEventListener('dblclick', onDouble);
    window.addEventListener('keydown', onKey);
    return () => {
      el.style.cursor = '';
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('click', block);
      el.removeEventListener('dblclick', onDouble);
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, gl, camera]);

  if (!tool) return null;
  const preview = tool === 'lines' && hover && points.length ? [...points, hover] : points;
  return (
    <group position={[0, 0.03, 0]} raycast={() => null}>
      {preview.length >= 2 && (
        <Line
          points={preview.map(([x, z]) => [x, 0, z] as [number, number, number])}
          color="#ff2d94"
          lineWidth={3}
          raycast={() => null}
        />
      )}
      {points.length > 0 && (
        <mesh position={[points[0][0], 0, points[0][1]]} raycast={() => null}>
          <sphereGeometry args={[0.12, 16, 12]} />
          <meshBasicMaterial color="#915bff" />
        </mesh>
      )}
    </group>
  );
}
