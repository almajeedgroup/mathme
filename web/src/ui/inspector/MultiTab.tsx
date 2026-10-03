import { Button, Stack, Text } from '@mantine/core';

import type { SceneNode } from '../../engine/types';
import { deleteSelection, duplicateSelection, groupSelection } from '../actions';
import { notifications } from '../notify';
import { BooleanTools } from '../service/BooleanTools';

export function MultiTab({ nodes }: { nodes: SceneNode[] }) {
  return (
    <Stack gap="sm">
      <Text fw={600}>{nodes.length} things selected</Text>
      <Text size="xs" c="dimmed">
        Hold Shift and click to select more or fewer.
      </Text>
      <Button
        size="xs"
        onClick={() => {
          if (!groupSelection())
            notifications.show({
              color: 'orange',
              message: 'Only things in the same group can be grouped together.',
            });
        }}
      >
        Group them
      </Button>
      <Button size="xs" variant="light" onClick={duplicateSelection}>
        Duplicate
      </Button>
      <Button size="xs" variant="light" color="red" onClick={deleteSelection}>
        Delete
      </Button>
      <BooleanTools nodes={nodes} />
    </Stack>
  );
}
