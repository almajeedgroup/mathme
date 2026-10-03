import { ActionIcon, Button, Group, NumberInput, SegmentedControl, Text, Tooltip } from '@mantine/core';
import { IconCheck, IconLine, IconPencil, IconViewfinder } from '@tabler/icons-react';

import { useProjectStore } from '../state/projectStore';
import { useUiStore } from '../state/uiStore';

const UNIT = { mm: 'mm', cm: 'cm', m: 'm' } as const;

/** The pencil's options, shown over the 3D view while drawing. */
export function DrawToolbar() {
  const draw = useUiStore((s) => s.draw);
  const setDraw = useUiStore((s) => s.setDraw);
  const lookAlong = useUiStore((s) => s.lookAlong);
  const units = useProjectStore((s) => s.project.units);
  if (!draw.tool) return null;
  const solid = draw.make === 'solid';
  const hint =
    draw.tool === 'pencil'
      ? solid
        ? 'Draw a closed outline on the floor. It becomes a solid.'
        : 'Draw any line on the floor. It becomes a tube.'
      : 'Click corner to corner. Click the first corner (or press Enter) to finish.';
  return (
    <div className="mm-draw-bar" data-testid="draw-toolbar">
      <Group gap={6} wrap="wrap" justify="center" className="mm-float" p={6} px={8}>
        <SegmentedControl
          size="xs"
          radius="xl"
          value={draw.tool}
          onChange={(v) => setDraw({ tool: v as 'pencil' | 'lines' })}
          data={[
            {
              value: 'pencil',
              label: (
                <Group gap={4} wrap="nowrap">
                  <IconPencil size={14} /> Pencil
                </Group>
              ),
            },
            {
              value: 'lines',
              label: (
                <Group gap={4} wrap="nowrap">
                  <IconLine size={14} /> Lines
                </Group>
              ),
            },
          ]}
          aria-label="Drawing tool"
        />
        <SegmentedControl
          size="xs"
          radius="xl"
          value={draw.make}
          onChange={(v) => setDraw({ make: v as 'solid' | 'tube' })}
          data={[
            { value: 'solid', label: 'Solid' },
            { value: 'tube', label: 'Tube' },
          ]}
          aria-label="Make it into"
        />
        <NumberInput
          size="xs"
          w={118}
          radius="xl"
          min={0.05}
          max={50}
          step={solid ? 0.5 : 0.1}
          decimalScale={2}
          value={solid ? draw.thickness : draw.width}
          onChange={(v) => {
            const n = typeof v === 'number' ? v : parseFloat(v);
            if (Number.isFinite(n) && n > 0) setDraw(solid ? { thickness: n } : { width: n });
          }}
          leftSection={<Text size="xs">{solid ? 'H' : 'W'}</Text>}
          rightSection={<Text size="xs">{UNIT[units]}</Text>}
          aria-label={solid ? 'Height' : 'Tube width'}
        />
        <Tooltip label="Look straight down at the floor">
          <ActionIcon radius="xl" onClick={() => lookAlong([0, -1, -0.0001])} aria-label="Look from above">
            <IconViewfinder size={17} />
          </ActionIcon>
        </Tooltip>
        <Button
          size="xs"
          radius="xl"
          leftSection={<IconCheck size={14} />}
          onClick={() => setDraw({ tool: null })}
          data-testid="draw-done"
        >
          Done
        </Button>
      </Group>
      <Text size="xs" c="dimmed" ta="center" mt={4} className="mm-draw-hint">
        {hint}
      </Text>
    </div>
  );
}
