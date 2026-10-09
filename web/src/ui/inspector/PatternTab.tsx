import { gate } from '../../account/limits';
import { ActionIcon, Alert, Group, NumberInput, Select, Stack, Text, Tooltip } from '@mantine/core';
import { IconDice5 } from '@tabler/icons-react';

import { MAX_OBJECTS, WARN_OBJECTS } from '../../engine/layout';
import { fmtCount } from '../../engine/math';
import { getPattern, PATTERN_LIST } from '../../engine/patterns/registry';
import { symmetryCopyCount } from '../../engine/three/transforms';
import type { PatternNode, PatternType } from '../../engine/types';
import { NumberSliderField } from '../fields/NumberSliderField';
import { ParamFields } from '../fields/ParamFields';
import { useNodeUpdater, useUnits } from './common';

export function PatternTab({ node }: { node: PatternNode }) {
  const update = useNodeUpdater(node);
  const units = useUnits();
  const def = getPattern(node.pattern.type);
  const total = node.count * symmetryCopyCount(node.symmetry);
  return (
    <Stack gap="sm">
      <Select
        size="xs"
        label="Pattern"
        data={PATTERN_LIST.map((p) => ({ value: p.type, label: `${p.icon}  ${p.label}` }))}
        value={node.pattern.type}
        allowDeselect={false}
        onChange={(v) =>
          v &&
          update((n) => {
            const next = getPattern(v as PatternType);
            n.pattern = { type: next.type, params: structuredClone(next.defaults) };
          })
        }
      />
      <Text size="xs" c="dimmed">
        {def.description}
      </Text>
      <NumberSliderField
        label="How many?"
        help="How many copies of the shape the pattern makes."
        value={node.count}
        min={1}
        max={1000}
        hardMax={MAX_OBJECTS}
        step={1}
        integer
        onChange={(v) => {
          if (v > node.count && !gate({ kind: 'objects', count: total - node.count + v })) return;
          update((n) => void (n.count = v));
        }}
      />
      {total > WARN_OBJECTS && (
        <Alert color="orange" p="xs">
          {fmtCount(total)} objects is a lot. Your computer may slow down. The most one pattern can make is{' '}
          {fmtCount(MAX_OBJECTS)}.
        </Alert>
      )}
      <ParamFields
        fields={def.fields}
        params={node.pattern.params}
        defaults={def.defaults}
        units={units}
        onChange={(key, value) => update((n) => void (n.pattern.params[key] = value))}
      />
      <Group gap="xs" align="flex-end" wrap="nowrap">
        <NumberInput
          size="xs"
          label="Random seed"
          description="Same seed = same random result"
          value={node.seed}
          min={0}
          max={999999}
          onChange={(v) => typeof v === 'number' && update((n) => void (n.seed = Math.round(v)))}
          flex={1}
        />
        <Tooltip label="Shuffle (new random seed)">
          <ActionIcon
            variant="light"
            size="lg"
            aria-label="Shuffle random seed"
            onClick={() => update((n) => void (n.seed = Math.floor(Math.random() * 999999)))}
          >
            <IconDice5 size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Stack>
  );
}
