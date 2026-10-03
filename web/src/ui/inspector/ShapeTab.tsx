import { Alert, Button, Group, Select, Stack, Text } from '@mantine/core';

import {
  GRAPH_PRESETS,
  LATHE_PRESETS,
  OUTLINE_PRESETS,
  PARAMETRIC_PRESETS,
} from '../../engine/shapes/profiles';
import { defaultShape, getShape, SHAPE_LIST } from '../../engine/shapes/registry';
import type { ObjectNode, PatternNode, ShapeType } from '../../engine/types';
import { useProjectStore } from '../../state/projectStore';
import { ParamFields } from '../fields/ParamFields';
import { useNodeUpdater, useUnits } from './common';

const shapeOptions = [
  { group: 'Basic', items: SHAPE_LIST.filter((s) => s.category === 'basic') },
  { group: 'Solids', items: SHAPE_LIST.filter((s) => s.category === 'solid') },
  { group: 'Make your own', items: SHAPE_LIST.filter((s) => s.category === 'custom' && !s.hidden) },
].map((g) => ({
  group: g.group,
  items: g.items.map((s) => ({ value: s.type, label: `${s.icon}  ${s.label}` })),
}));

export function ShapeTab({ node }: { node: ObjectNode | PatternNode }) {
  const update = useNodeUpdater(node);
  const units = useUnits();
  const library = useProjectStore((s) => s.project.library);

  if (node.source.kind === 'custom') {
    const custom = library.find((c) => c.id === (node.source as { customId: string }).customId);
    return (
      <Alert color="violet" title={custom ? `My shape: ${custom.name}` : 'Missing shape'}>
        {custom
          ? `Made of ${custom.parts.length} parts. To change it, add it again from “Mine”, edit the parts, then save it as a new shape.`
          : 'This custom shape was deleted.'}
      </Alert>
    );
  }

  const shape = node.source.shape;
  const def = getShape(shape.type);
  const formulaPresets =
    shape.type === 'graphSurface' ? GRAPH_PRESETS : shape.type === 'parametric' ? PARAMETRIC_PRESETS : null;

  return (
    <Stack gap="sm">
      {shape.type !== 'mesh' && (
        <Select
          size="xs"
          label="Shape"
          data={shapeOptions}
          value={shape.type}
          allowDeselect={false}
          onChange={(v) =>
            v &&
            update((n) => {
              if (n.source.kind === 'shape') n.source.shape = defaultShape(v as ShapeType);
            })
          }
        />
      )}
      <Text size="xs" c="dimmed">
        {def.description}
      </Text>
      {formulaPresets && (
        <Group gap={4}>
          <Text size="xs" fw={500}>
            Try:
          </Text>
          {formulaPresets.map((p) => (
            <Button
              key={p.id}
              size="compact-xs"
              variant="light"
              onClick={() =>
                update((n) => {
                  if (n.source.kind === 'shape')
                    n.source.shape.params = { ...n.source.shape.params, ...p.params };
                })
              }
            >
              {p.label}
            </Button>
          ))}
        </Group>
      )}
      <ParamFields
        fields={def.fields}
        params={shape.params}
        defaults={def.defaults}
        units={units}
        pointPresets={(mode) => (mode === 'profile' ? LATHE_PRESETS : OUTLINE_PRESETS)}
        onChange={(key, value) =>
          update((n) => {
            if (n.source.kind === 'shape') n.source.shape.params[key] = value;
          })
        }
      />
    </Stack>
  );
}
