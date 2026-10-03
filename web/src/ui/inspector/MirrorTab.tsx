import { Checkbox, Group, Stack, Text } from '@mantine/core';

import { symmetryCopyCount } from '../../engine/three/transforms';
import type { SceneNode } from '../../engine/types';
import { NumberSliderField } from '../fields/NumberSliderField';
import { useNodeUpdater } from './common';

export function MirrorTab({ node }: { node: SceneNode }) {
  const update = useNodeUpdater(node);
  const s = node.symmetry;
  const copies = symmetryCopyCount(s);
  return (
    <Stack gap="sm">
      <Text size="xs" c="dimmed">
        Symmetry makes mirror copies, like a butterfly, or spins copies around the middle, like a snowflake.
        Mirrors pass through the center of the scene (the origin).
      </Text>
      <Text size="sm" fw={500}>
        Mirror across
      </Text>
      <Group>
        <Checkbox
          label="X (left ↔ right)"
          checked={s.mirrorX}
          onChange={(e) => update((n) => void (n.symmetry.mirrorX = e.currentTarget.checked))}
        />
        <Checkbox
          label="Y (up ↕ down)"
          checked={s.mirrorY}
          onChange={(e) => update((n) => void (n.symmetry.mirrorY = e.currentTarget.checked))}
        />
        <Checkbox
          label="Z (front ↔ back)"
          checked={s.mirrorZ}
          onChange={(e) => update((n) => void (n.symmetry.mirrorZ = e.currentTarget.checked))}
        />
      </Group>
      <NumberSliderField
        label="Spin copies around the middle"
        help="Kaleidoscope: 1 = off, 6 = six copies turned 60° apart like a snowflake."
        value={s.radialCopies}
        min={1}
        max={24}
        step={1}
        integer
        onChange={(v) => update((n) => void (n.symmetry.radialCopies = v))}
      />
      {s.radialCopies > 1 && (
        <Text size="xs">
          Each copy is turned 360° ÷ {s.radialCopies} = {(360 / s.radialCopies).toFixed(1)}° from the last.
        </Text>
      )}
      <Text size="xs" c="dimmed">
        Copies: {copies}{' '}
        {copies === 1
          ? '(symmetry is off)'
          : `= ${s.radialCopies} spun × ${copies / s.radialCopies} mirrored`}
      </Text>
    </Stack>
  );
}
