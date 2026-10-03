import { SimpleGrid, Stack, Text } from '@mantine/core';

import { PATTERN_LIST } from '../engine/patterns/registry';
import { useProjectStore } from '../state/projectStore';
import { useUiStore } from '../state/uiStore';
import { applyPattern } from './actions';
import { TileButton } from './ShapeLibrary';

export function PatternPicker() {
  const selectedKind = useUiStore((s) => (s.selectedIds.length === 1 ? s.selectedIds[0] : null));
  const node = useProjectStore((s) => s.project.nodes.find((n) => n.id === selectedKind));
  const hint =
    node?.kind === 'object'
      ? `Copies “${node.name}” into a pattern.`
      : node?.kind === 'pattern'
        ? `Changes the pattern of “${node.name}”.`
        : 'Select an object first to copy it, or start with spheres.';
  return (
    <Stack gap={6}>
      <Text className="mm-label">Make a pattern</Text>
      <Text size="xs" c="dimmed">
        {hint}
      </Text>
      <SimpleGrid cols={3} spacing={2}>
        {PATTERN_LIST.map((p) => (
          <TileButton
            key={p.type}
            icon={p.icon}
            label={p.label}
            description={p.description}
            onClick={() => applyPattern(p.type)}
            testId={`pattern-${p.type}`}
          />
        ))}
      </SimpleGrid>
    </Stack>
  );
}
