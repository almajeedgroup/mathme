import { Group, NumberInput, Slider, Stack, Text } from '@mantine/core';

import { clamp, fmt } from '../../engine/math';
import { FieldLabel } from './FieldLabel';

export interface NumberSliderFieldProps {
  label: string;
  help?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  hardMax?: number;
  integer?: boolean;
  suffix?: string;
  onChange(value: number): void;
}

export function NumberSliderField(props: NumberSliderFieldProps) {
  const { label, help, value, min, max, step, hardMax, integer, suffix, onChange } = props;
  const commit = (v: number) => {
    const limited = clamp(v, min, hardMax ?? max);
    onChange(integer ? Math.round(limited) : limited);
  };
  return (
    <Stack gap={2}>
      <FieldLabel label={label} help={help} />
      <Group gap="xs" wrap="nowrap">
        <Slider
          flex={1}
          min={min}
          max={max}
          step={step}
          value={clamp(value, min, max)}
          onChange={commit}
          label={(v) => `${fmt(v)}${suffix ? ` ${suffix}` : ''}`}
          thumbLabel={label}
          size="sm"
        />
        <NumberInput
          w={96}
          size="xs"
          value={Number(fmt(value, 3))}
          min={min}
          max={hardMax ?? max}
          step={step}
          decimalScale={integer ? 0 : 3}
          onChange={(v) => {
            if (typeof v === 'number' && Number.isFinite(v)) commit(v);
          }}
          rightSection={
            suffix ? (
              <Text size="xs" c="dimmed">
                {suffix}
              </Text>
            ) : undefined
          }
          rightSectionWidth={suffix ? 28 : undefined}
          aria-label={label}
          hideControls
        />
      </Group>
    </Stack>
  );
}
