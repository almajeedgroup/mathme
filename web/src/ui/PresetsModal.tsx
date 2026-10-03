import { Card, Modal, SimpleGrid, Text, UnstyledButton } from '@mantine/core';

import { PRESETS } from '../engine/project/presets';
import { useUiStore } from '../state/uiStore';
import { loadProject, openHeart } from './actions';
import { openCutTool } from './CutPanel';
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
        <UnstyledButton
          data-testid="preset-heart"
          onClick={async () => {
            setOpen('presetsOpen', false);
            try {
              await openHeart();
              // wait for the heart to be drawn so the cut tool can measure it
              await new Promise((r) => setTimeout(r, 400));
              openCutTool();
              notifications.show({
                color: 'violet',
                message:
                  'Opened the real human heart. Pick a standard view in the cut panel, or drag the sliders.',
              });
            } catch (e) {
              notifications.show({ color: 'red', message: e instanceof Error ? e.message : String(e) });
            }
          }}
        >
          <Card withBorder padding="sm" radius="md" h="100%" className="tile-button">
            <Text size="xl">🫀</Text>
            <Text fw={600}>Human heart (real anatomy)</Text>
            <Text size="xs" c="dimmed">
              A scan-based heart from the Human Reference Atlas with 51 named parts. Cut it at any angle or
              pick the four-chamber, short-axis and other standard views.
            </Text>
          </Card>
        </UnstyledButton>
        {PRESETS.map((p) => (
          <UnstyledButton
            key={p.id}
            data-testid={`preset-${p.id}`}
            onClick={() => {
              loadProject(p.build());
              setOpen('presetsOpen', false);
              notifications.show({ color: 'violet', message: `Opened “${p.title}”. Press Undo to go back.` });
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
