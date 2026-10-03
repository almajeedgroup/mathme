import { Group, NumberInput, Stack } from '@mantine/core';

import { fmt } from '../../engine/math';
import type { Vec3 } from '../../engine/types';
import { FieldLabel } from './FieldLabel';

const AXES = [
  { name: 'X', color: '#fa5252', hint: 'left ↔ right' },
  { name: 'Y', color: '#40c057', hint: 'down ↕ up' },
  { name: 'Z', color: '#4c6ef5', hint: 'back ↔ front' },
];

export function Vec3Field({
  label,
  help,
  value,
  step = 0.5,
  suffix,
  onChange,
}: {
  label: string;
  help?: string;
  value: Vec3;
  step?: number;
  suffix?: string;
  onChange(v: Vec3): void;
}) {
  return (
    <Stack gap={2}>
      <FieldLabel label={label} help={help} />
      <Group gap={6} wrap="nowrap" grow>
        {AXES.map((axis, i) => (
          <NumberInput
            key={axis.name}
            size="xs"
            value={Number(fmt(value[i], 3))}
            step={step}
            decimalScale={3}
            title={`${axis.name}: ${axis.hint}`}
            aria-label={`${label} ${axis.name}`}
            leftSection={
              <span style={{ color: axis.color, fontWeight: 700, fontSize: 12 }}>{axis.name}</span>
            }
            leftSectionWidth={22}
            rightSection={suffix ? <span style={{ fontSize: 10, opacity: 0.6 }}>{suffix}</span> : undefined}
            onChange={(v) => {
              if (typeof v !== 'number' || !Number.isFinite(v)) return;
              const next = [...value] as Vec3;
              next[i] = v;
              onChange(next);
            }}
          />
        ))}
      </Group>
    </Stack>
  );
}
