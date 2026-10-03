import { ActionIcon, Paper, SimpleGrid, Stack, Tabs, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { notifications } from './notify';

import { SHAPE_LIST } from '../engine/shapes/registry';
import type { ShapeCategory } from '../engine/shapes/types';
import { useProjectStore } from '../state/projectStore';
import { addCustomShape, addShape } from './actions';

export function TileButton({
  icon,
  label,
  description,
  onClick,
  testId,
}: {
  icon: string;
  label: string;
  description?: string;
  onClick(): void;
  testId?: string;
}) {
  return (
    <Tooltip label={description ?? label} multiline w={220} withArrow openDelay={400} disabled={!description}>
      <UnstyledButton onClick={onClick} data-testid={testId} aria-label={`Add ${label}`}>
        <Paper
          withBorder
          p={6}
          radius="md"
          style={{ textAlign: 'center', height: '100%' }}
          className="tile-button"
        >
          <div style={{ fontSize: 22, lineHeight: 1.2 }} aria-hidden>
            {icon}
          </div>
          <Text size="xs" lh={1.2} mt={2}>
            {label}
          </Text>
        </Paper>
      </UnstyledButton>
    </Tooltip>
  );
}

function ShapeGrid({ category }: { category: ShapeCategory }) {
  return (
    <SimpleGrid cols={3} spacing={6}>
      {SHAPE_LIST.filter((s) => s.category === category && !s.hidden).map((s) => (
        <TileButton
          key={s.type}
          icon={s.icon}
          label={s.label}
          description={s.description}
          onClick={() => addShape(s.type)}
          testId={`add-shape-${s.type}`}
        />
      ))}
    </SimpleGrid>
  );
}

export function ShapeLibrary() {
  const library = useProjectStore((s) => s.project.library);
  const removeCustomShape = useProjectStore((s) => s.removeCustomShape);
  return (
    <Stack gap={6}>
      <Text fw={700} size="sm">
        1. Add a shape
      </Text>
      <Tabs defaultValue="basic" variant="pills" radius="md">
        <Tabs.List grow mb={6}>
          <Tabs.Tab value="basic" size="xs" px={6}>
            Basic
          </Tabs.Tab>
          <Tabs.Tab value="solid" px={6}>
            Solids
          </Tabs.Tab>
          <Tabs.Tab value="custom" px={6}>
            Make
          </Tabs.Tab>
          <Tabs.Tab value="mine" px={6}>
            Mine{library.length ? ` (${library.length})` : ''}
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="basic">
          <ShapeGrid category="basic" />
        </Tabs.Panel>
        <Tabs.Panel value="solid">
          <ShapeGrid category="solid" />
        </Tabs.Panel>
        <Tabs.Panel value="custom">
          <ShapeGrid category="custom" />
        </Tabs.Panel>
        <Tabs.Panel value="mine">
          {library.length === 0 ? (
            <Text size="xs" c="dimmed">
              Your own shapes appear here. Select a few objects, press Group, then “Save as my shape”.
            </Text>
          ) : (
            <SimpleGrid cols={3} spacing={6}>
              {library.map((c) => (
                <div key={c.id} style={{ position: 'relative' }}>
                  <TileButton
                    icon="🧩"
                    label={c.name}
                    description={`${c.parts.length} parts`}
                    onClick={() => addCustomShape(c.id)}
                  />
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="red"
                    style={{ position: 'absolute', top: 2, right: 2 }}
                    aria-label={`Delete ${c.name}`}
                    onClick={() => {
                      if (!removeCustomShape(c.id))
                        notifications.show({
                          color: 'orange',
                          message: `“${c.name}” is still used in your scene. Delete those objects first.`,
                        });
                    }}
                  >
                    <IconTrash size={12} />
                  </ActionIcon>
                </div>
              ))}
            </SimpleGrid>
          )}
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
