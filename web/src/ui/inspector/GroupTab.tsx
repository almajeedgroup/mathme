import { Button, Group, Stack, Text, TextInput } from '@mantine/core';
import { useState } from 'react';

import type { GroupNode } from '../../engine/types';
import { useProjectStore } from '../../state/projectStore';
import { saveAsCustomShape, ungroupSelection } from '../actions';
import { notifications } from '../notify';

export function GroupTab({ node }: { node: GroupNode }) {
  const count = useProjectStore((s) => s.project.nodes.filter((n) => n.parentId === node.id).length);
  const [name, setName] = useState(node.name === 'Group' ? 'My shape' : node.name);
  return (
    <Stack gap="sm">
      <Text size="sm">
        This group holds {count} {count === 1 ? 'thing' : 'things'}. Moving the group moves everything inside
        it.
      </Text>
      <Button variant="light" size="xs" onClick={ungroupSelection}>
        Ungroup
      </Button>
      <Text size="sm" fw={600} mt="sm">
        Save as my shape
      </Text>
      <Text size="xs" c="dimmed">
        Saves this group as a new shape in “Mine”, so you can reuse it or make patterns from it (e.g. a spiral
        of little houses).
      </Text>
      <Group gap="xs" align="flex-end" wrap="nowrap">
        <TextInput
          size="xs"
          label="Name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          flex={1}
        />
        <Button
          size="xs"
          onClick={() => {
            const result = saveAsCustomShape(node.id, name.trim() || 'My shape');
            notifications.show(
              result.ok
                ? { color: 'green', message: `Saved “${name}” to Mine.` }
                : { color: 'red', message: result.error },
            );
          }}
        >
          Save
        </Button>
      </Group>
    </Stack>
  );
}
