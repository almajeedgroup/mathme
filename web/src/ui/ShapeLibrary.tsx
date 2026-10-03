import { ActionIcon, Stack, Tabs, Text } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { notifications } from './notify';

import { SHAPE_LIST } from '../engine/shapes/registry';
import type { ShapeCategory } from '../engine/shapes/types';
import { useProjectStore } from '../state/projectStore';
import { addCustomShape, addShape } from './actions';
import { NavRow } from './NavRow';

/** A sidebar row that adds something: a grey icon (coloured on hover) and a name. */
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
    <NavRow
      icon={<span className="tile-icon">{icon}</span>}
      label={label}
      tooltip={description}
      onClick={onClick}
      testId={testId}
      ariaLabel={`Add ${label}`}
    />
  );
}

function ShapeGrid({ category }: { category: ShapeCategory }) {
  return (
    <Stack gap={1}>
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
    </Stack>
  );
}

export function ShapeLibrary() {
  const library = useProjectStore((s) => s.project.library);
  const removeCustomShape = useProjectStore((s) => s.removeCustomShape);
  return (
    <Stack gap={6}>
      <Tabs defaultValue="basic" variant="pills" radius="xl">
        <Tabs.List grow mb={4} px={4}>
          <Tabs.Tab value="basic" px={6} py={4} fz="xs">
            Basic
          </Tabs.Tab>
          <Tabs.Tab value="solid" px={6} py={4} fz="xs">
            Solids
          </Tabs.Tab>
          <Tabs.Tab value="custom" px={6} py={4} fz="xs">
            Make
          </Tabs.Tab>
          <Tabs.Tab value="mine" px={6} py={4} fz="xs">
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
            <Stack gap={1}>
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
                    style={{ position: 'absolute', top: 6, right: 6 }}
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
            </Stack>
          )}
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
