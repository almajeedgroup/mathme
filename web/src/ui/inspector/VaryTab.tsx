import { SegmentedControl, Stack, Switch, Text } from '@mantine/core';

import type { PatternNode, SizeMode } from '../../engine/types';
import { FieldLabel } from '../fields/FieldLabel';
import { NumberSliderField } from '../fields/NumberSliderField';
import { Vec3Field } from '../fields/Vec3Field';
import { useNodeUpdater, useUnits } from './common';

export function VaryTab({ node }: { node: PatternNode }) {
  const update = useNodeUpdater(node);
  const units = useUnits();
  const v = node.variation;
  return (
    <Stack gap="sm">
      <Text size="xs" c="dimmed">
        Make each copy a little different: bigger or smaller, turned, or shaken about.
      </Text>
      <Stack gap={2}>
        <FieldLabel
          label="How sizes change"
          help="Grow: small at the start, big at the end. Random: any size in between. Pulse: big in the middle."
        />
        <SegmentedControl
          size="xs"
          fullWidth
          value={v.sizeMode}
          data={[
            { value: 'ramp', label: 'Grow' },
            { value: 'random', label: 'Random' },
            { value: 'pulse', label: 'Pulse' },
          ]}
          onChange={(m) => update((n) => void (n.variation.sizeMode = m as SizeMode))}
        />
      </Stack>
      <NumberSliderField
        label="Size from"
        help="Size of the first object (1 = normal size, 2 = twice as big)."
        value={v.sizeFrom}
        min={0}
        max={5}
        step={0.05}
        hardMax={100}
        suffix="×"
        onChange={(x) => update((n) => void (n.variation.sizeFrom = x))}
      />
      <NumberSliderField
        label="Size to"
        help="Size of the last object."
        value={v.sizeTo}
        min={0}
        max={5}
        step={0.05}
        hardMax={100}
        suffix="×"
        onChange={(x) => update((n) => void (n.variation.sizeTo = x))}
      />
      <Switch
        label={
          <FieldLabel
            label="Line up with the pattern"
            help="Turn each object to face along the pattern (e.g. outwards from the center)."
          />
        }
        checked={v.followPattern}
        onChange={(e) => update((n) => void (n.variation.followPattern = e.currentTarget.checked))}
      />
      <NumberSliderField
        label="Extra spin per object"
        help="Each object is spun this many degrees more than the one before it."
        value={v.spinStep}
        min={-90}
        max={90}
        step={1}
        hardMax={3600}
        suffix="°"
        onChange={(x) => update((n) => void (n.variation.spinStep = x))}
      />
      <Vec3Field
        label="Tip every object"
        help="Turn every object by the same angle around X, Y and Z."
        value={v.objectRotation}
        step={15}
        suffix="°"
        onChange={(x) => update((n) => void (n.variation.objectRotation = x))}
      />
      <NumberSliderField
        label="Random wobble"
        help="Turn each object by a random angle, up to this many degrees."
        value={v.wobble}
        min={0}
        max={180}
        step={1}
        suffix="°"
        onChange={(x) => update((n) => void (n.variation.wobble = x))}
      />
      <NumberSliderField
        label="Random shake"
        help="Move each object a random distance (up to this much) away from its spot."
        value={v.jitter}
        min={0}
        max={5}
        step={0.05}
        hardMax={100}
        suffix={units}
        onChange={(x) => update((n) => void (n.variation.jitter = x))}
      />
    </Stack>
  );
}
