import { Line } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { DoubleSide, Plane, Quaternion, Vector3 } from 'three';

import { planeFromAngles } from '../engine/cutPlane';
import { useUiStore } from '../state/uiStore';

const NONE: Plane[] = [];

/** The current cutting plane as three.js clipping planes (empty when cutting is off). */
export function useClipPlanes(): Plane[] {
  const cut = useUiStore((s) => s.cut);
  return useMemo(() => {
    if (cut.mode === 'off') return NONE;
    const eq = planeFromAngles(cut, cut.centre);
    const n = new Vector3(...eq.normal);
    // three.js keeps the side where n·x + constant ≥ 0
    return cut.mode === 'a' ? [new Plane(n, -eq.d)] : [new Plane(n.negate(), eq.d)];
  }, [cut]);
}

/** A see-through sheet showing where the knife is, plus redraw on every change. */
export function CutPlaneHelper({ size }: { size: number }) {
  const cut = useUiStore((s) => s.cut);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [cut, invalidate]);
  const { position, quaternion } = useMemo(() => {
    const eq = planeFromAngles(cut, cut.centre);
    const q = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), new Vector3(...eq.normal));
    return { position: new Vector3(...eq.point), quaternion: q };
  }, [cut]);
  if (cut.mode === 'off') return null;
  return (
    <group position={position} quaternion={quaternion}>
      <mesh raycast={() => null} renderOrder={10}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial color="#f76707" transparent opacity={0.08} side={DoubleSide} depthWrite={false} />
      </mesh>
      <Line
        points={[
          [-size / 2, -size / 2, 0],
          [size / 2, -size / 2, 0],
          [size / 2, size / 2, 0],
          [-size / 2, size / 2, 0],
          [-size / 2, -size / 2, 0],
        ]}
        color="#f76707"
        lineWidth={1.5}
        raycast={() => null}
      />
    </group>
  );
}
