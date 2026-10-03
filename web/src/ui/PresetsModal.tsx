import { Card, Modal, SimpleGrid, Text, UnstyledButton } from '@mantine/core';

import { PRESETS } from '../engine/project/presets';
import { useUiStore } from '../state/uiStore';
import { loadProject } from './actions';
import { notifications } from './notify';

export function PresetsModal() {
  const open = useUiStore((s) => s.presetsOpen);
  const setOpen = useUiStore((s) => s.setOpen);
  return (
    <Modal
      opened={open}
      onClose={() => setOpen('presetsOpen', false)}
      title="Ideas to start from"
      size="xl"
      centered
    >
      <Text size="sm" c="dimmed" mb="md">
        Each idea replaces your current scene. Changed your mind? Press Undo.
      </Text>
      <SimpleGrid cols={{ base: 1, xs: 2, md: 3 }} spacing="sm">
        {PRESETS.map((p) => (
          <UnstyledButton
            key={p.id}
            data-testid={`preset-${p.id}`}
            onClick={() => {
              loadProject(p.build());
              setOpen('presetsOpen', false);
              notifications.show({ color: 'indigo', message: `Opened “${p.title}”. Press Undo to go back.` });
            }}
          >
            <Card withBorder padding="sm" radius="md" h="100%" className="tile-button">
              <Text size="xl">{p.icon}</Text>
              <Text fw={600}>{p.title}</Text>
              <Text size="xs" c="dimmed">
                {p.description}
              </Text>
            </Card>
          </UnstyledButton>
        ))}
      </SimpleGrid>
    </Modal>
  );
}
