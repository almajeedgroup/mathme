import { Button, Group, Stack, Text } from '@mantine/core';

import type { SceneNode } from '../../engine/types';
import { useUiStore } from '../../state/uiStore';
import { contentBounds } from '../../viewport/bounds';
import { Vec3Field } from '../fields/Vec3Field';
import { useNodeUpdater, useUnits } from './common';

export function PlaceTab({ node }: { node: SceneNode }) {
  const update = useNodeUpdater(node);
  const units = useUnits();
  const obj = useUiStore((s) => s.nodeObjects[node.id]);
  const t = node.transform;

  const dropToFloor = () => {
    if (!obj) return;
    const box = contentBounds(obj);
    if (box.isEmpty()) return;
    update(
      (n) =>
        void (n.transform.position = [
          t.position[0],
          Number((t.position[1] - box.min.y).toFixed(3)),
          t.position[2],
        ]),
    );
  };

  return (
    <Stack gap="sm">
      <Text size="xs" c="dimmed">
        Tip: drag the arrows in the 3D view, or type exact numbers here. X = left/right, Y = up/down, Z =
        front/back.
      </Text>
      <Vec3Field
        label="Position"
        help="Where the center of the object is."
        value={t.position}
        step={0.5}
        suffix={units}
        onChange={(v) => update((n) => void (n.transform.position = v))}
      />
      <Vec3Field
        label="Rotation"
        help="How much it is turned around each axis, in degrees."
        value={t.rotation}
        step={15}
        suffix="°"
        onChange={(v) => update((n) => void (n.transform.rotation = v))}
      />
      <Vec3Field
        label="Stretch"
        help="1 = normal, 2 = twice as big in that direction."
        value={t.scale}
        step={0.1}
        suffix="×"
        onChange={(v) => update((n) => void (n.transform.scale = v))}
      />
      <Group gap="xs">
        <Button size="xs" variant="light" onClick={dropToFloor}>
          Drop onto floor
        </Button>
        <Button
          size="xs"
          variant="subtle"
          onClick={() =>
            update((n) => void (n.transform = { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }))
          }
        >
          Reset
        </Button>
      </Group>
    </Stack>
  );
}
