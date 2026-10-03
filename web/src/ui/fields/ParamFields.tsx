import { SegmentedControl, Select, Stack, Switch, Text, TextInput } from '@mantine/core';

import { compileFormula } from '../../engine/expr';
import type { ParamField } from '../../engine/fields';
import type { ProfilePreset } from '../../engine/shapes/profiles';
import type { Params, ParamValue, Units } from '../../engine/types';
import { FieldLabel } from './FieldLabel';
import { NumberSliderField } from './NumberSliderField';
import { ProfileEditor } from './ProfileEditor';
import { unitSuffix } from './units';

export function ParamFields({
  fields,
  params,
  defaults,
  units,
  onChange,
  pointPresets,
}: {
  fields: ParamField[];
  params: Params;
  defaults: Params;
  units: Units;
  onChange(key: string, value: ParamValue): void;
  pointPresets?: (mode: 'profile' | 'outline') => ProfilePreset[];
}) {
  const merged = { ...defaults, ...params };
  return (
    <Stack gap="sm">
      {fields
        .filter((f) => !f.visibleIf || f.visibleIf(merged))
        .map((f) => (
          <ParamFieldInput
            key={f.key}
            field={f}
            value={merged[f.key]}
            units={units}
            onChange={(v) => onChange(f.key, v)}
            pointPresets={pointPresets}
          />
        ))}
    </Stack>
  );
}

function ParamFieldInput({
  field,
  value,
  units,
  onChange,
  pointPresets,
}: {
  field: ParamField;
  value: ParamValue | undefined;
  units: Units;
  onChange(v: ParamValue): void;
  pointPresets?: (mode: 'profile' | 'outline') => ProfilePreset[];
}) {
  switch (field.kind) {
    case 'number':
      return (
        <NumberSliderField
          label={field.label}
          help={field.help}
          value={typeof value === 'number' ? value : field.min}
          min={field.min}
          max={field.max}
          step={field.step}
          hardMax={field.hardMax}
          integer={field.integer}
          suffix={unitSuffix(field.unit, units)}
          onChange={onChange}
        />
      );
    case 'select':
      return (
        <Stack gap={2}>
          <FieldLabel label={field.label} help={field.help} />
          {field.options.length <= 3 ? (
            <SegmentedControl
              size="xs"
              fullWidth
              value={String(value ?? field.options[0].value)}
              data={field.options}
              onChange={onChange}
            />
          ) : (
            <Select
              size="xs"
              value={String(value ?? field.options[0].value)}
              data={field.options}
              allowDeselect={false}
              onChange={(v) => v && onChange(v)}
            />
          )}
        </Stack>
      );
    case 'boolean':
      return (
        <Switch
          label={<FieldLabel label={field.label} help={field.help} />}
          checked={Boolean(value)}
          onChange={(e) => onChange(e.currentTarget.checked)}
        />
      );
    case 'text': {
      const text = typeof value === 'string' ? value : String(value ?? '');
      const check = field.formulaVars ? compileFormula(text, field.formulaVars) : null;
      return (
        <TextInput
          size="xs"
          label={<FieldLabel label={field.label} help={field.help} />}
          value={text}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.currentTarget.value)}
          error={check && !check.ok ? check.error : undefined}
          styles={
            field.formulaVars ? { input: { fontFamily: 'var(--mantine-font-family-monospace)' } } : undefined
          }
          spellCheck={false}
          autoComplete="off"
        />
      );
    }
    case 'points':
      return (
        <ProfileEditor
          label={field.label}
          mode={field.mode}
          points={Array.isArray(value) ? value : []}
          presets={pointPresets?.(field.mode) ?? []}
          onChange={onChange}
        />
      );
    default:
      return <Text size="xs">Unsupported field</Text>;
  }
}
