import { Code, List, Paper, Slider, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconBulb } from '@tabler/icons-react';
import { useState } from 'react';

import { getPattern } from '../../engine/patterns/registry';
import type { PatternNode } from '../../engine/types';
import { useUiStore } from '../../state/uiStore';

export function LearnTab({ node }: { node: PatternNode }) {
  const def = getPattern(node.pattern.type);
  const params = { ...def.defaults, ...node.pattern.params };
  const ex = def.explain(params, node.count);
  const picked = useUiStore((s) =>
    s.selectedInstance?.nodeId === node.id ? s.selectedInstance.index : null,
  );
  const [chosen, setChosen] = useState<number | null>(null);
  const i = Math.min(node.count - 1, chosen ?? picked ?? Math.min(10, node.count - 1));
  const worked = ex.worked(i);

  return (
    <Stack gap="sm" data-testid="learn-panel">
      <Paper withBorder p="sm" radius="md" bg="var(--mantine-color-yellow-light)">
        <Stack gap={6}>
          <ThemeIcon variant="light" color="yellow" size="sm">
            <IconBulb size={14} />
          </ThemeIcon>
          <Text size="sm">{ex.idea}</Text>
        </Stack>
      </Paper>
      <Text size="sm" fw={600}>
        The maths
      </Text>
      <Code block fz="xs">
        {ex.formulas.join('\n')}
      </Code>
      {worked.length > 0 && (
        <>
          <Text size="sm" fw={600}>
            Worked example: object i = {i}
          </Text>
          <Text size="xs" c="dimmed">
            Click an object in the 3D view, or slide to pick one.
          </Text>
          <Slider
            min={0}
            max={Math.max(0, node.count - 1)}
            step={1}
            value={i}
            onChange={setChosen}
            thumbLabel="Pick an object"
            size="sm"
          />
          <List size="sm" spacing={2}>
            {worked.map((line) => (
              <List.Item key={line}>
                <Code fz="xs">{line}</Code>
              </List.Item>
            ))}
          </List>
        </>
      )}
    </Stack>
  );
}
