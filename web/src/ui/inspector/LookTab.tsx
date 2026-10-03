import { ColorInput, SegmentedControl, Stack, Switch, Text } from '@mantine/core';

import { PALETTE } from '../../engine/project/defaults';
import type { ColorMode, MaterialDef, ObjectNode, PatternNode } from '../../engine/types';
import { FieldLabel } from '../fields/FieldLabel';
import { NumberSliderField } from '../fields/NumberSliderField';
import { useNodeUpdater } from './common';

const SWATCHES = [...PALETTE, '#ffffff', '#868e96', '#212529', '#a0522d', '#ffd43b'];

export function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange(v: string): void;
}) {
  return (
    <ColorInput
      size="xs"
      label={label}
      value={value}
      format="hex"
      swatches={SWATCHES}
      swatchesPerRow={7}
      withEyeDropper={false}
      onChange={(v) => /^#[0-9a-fA-F]{6}$/.test(v) && onChange(v.toLowerCase())}
    />
  );
}

export function LookTab({ node }: { node: ObjectNode | PatternNode }) {
  const update = useNodeUpdater<ObjectNode | PatternNode>(node);
  const m = node.material;
  const setMat = (patch: Partial<MaterialDef>) => update((n) => void Object.assign(n.material, patch));
  const pattern = node.kind === 'pattern' ? node : null;
  const mode = pattern?.variation.colorMode ?? 'single';
  const isCustom = node.source.kind === 'custom';

  return (
    <Stack gap="sm">
      {pattern && (
        <Stack gap={2}>
          <FieldLabel
            label="Colours"
            help="One colour for all, a smooth gradient from one colour to another, a rainbow, or random colours."
          />
          <SegmentedControl
            size="xs"
            fullWidth
            value={mode}
            data={[
              { value: 'single', label: 'One' },
              { value: 'gradient', label: 'Fade' },
              { value: 'rainbow', label: 'Rainbow' },
              { value: 'random', label: 'Random' },
            ]}
            onChange={(c) =>
              update((n) => n.kind === 'pattern' && void (n.variation.colorMode = c as ColorMode))
            }
          />
        </Stack>
      )}
      {mode === 'gradient' && pattern && (
        <>
          <ColorPicker
            label="First colour"
            value={pattern.variation.colorFrom}
            onChange={(c) => update((n) => n.kind === 'pattern' && void (n.variation.colorFrom = c))}
          />
          <ColorPicker
            label="Last colour"
            value={pattern.variation.colorTo}
            onChange={(c) => update((n) => n.kind === 'pattern' && void (n.variation.colorTo = c))}
          />
        </>
      )}
      {mode === 'single' &&
        (isCustom ? (
          <Text size="xs" c="dimmed">
            Each part of your shape keeps its own colour.
          </Text>
        ) : (
          <ColorPicker label="Colour" value={m.color} onChange={(c) => setMat({ color: c })} />
        ))}
      {!isCustom && (
        <>
          <NumberSliderField
            label="Metal look"
            help="0 = plastic or paint, 1 = shiny metal."
            value={m.metalness}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => setMat({ metalness: v })}
          />
          <NumberSliderField
            label="Roughness"
            help="0 = glossy and smooth like glass, 1 = rough and dull like chalk."
            value={m.roughness}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => setMat({ roughness: v })}
          />
          <NumberSliderField
            label="Solid ↔ see-through"
            help="1 = solid, 0 = invisible."
            value={m.opacity}
            min={0.05}
            max={1}
            step={0.05}
            onChange={(v) => setMat({ opacity: v })}
          />
          <Switch
            label="Wire frame (show the triangles)"
            checked={m.wireframe}
            onChange={(e) => setMat({ wireframe: e.currentTarget.checked })}
          />
          <Switch
            label="Faceted (flat sides)"
            checked={m.flatShading}
            onChange={(e) => setMat({ flatShading: e.currentTarget.checked })}
          />
        </>
      )}
    </Stack>
  );
}
