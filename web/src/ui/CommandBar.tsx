import { ActionIcon, Group, Menu, Popover, Text, TextInput, Tooltip } from '@mantine/core';
import { IconChevronDown, IconSparkles } from '@tabler/icons-react';
import { useState } from 'react';

import { EXAMPLE_COMMANDS } from '../engine/command/examples';
import { parseCommand } from '../engine/command/parser';
import { useUiStore } from '../state/uiStore';
import { applyCommand } from './actions';
import { askMathMe } from './assistant';
import { notifications } from './notify';

export function CommandBar() {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const run = async (input = text) => {
    const result = parseCommand(input);
    if (!result.ok) {
      // the recipe reader is stuck: let the AI model try, when the geometry service has one
      if (useUiStore.getState().assistantOnline || useUiStore.getState().claudeChat) {
        const answer = await askMathMe(input);
        if (answer.ok) {
          setError(null);
          notifications.show({ color: 'violet', title: 'MathMe', message: answer.reply });
          return;
        }
      }
      setError(result.error);
      return;
    }
    setError(null);
    const summary = applyCommand(result);
    notifications.show({
      color: 'violet',
      message: result.notes.length ? `${summary}. ${result.notes.join(' ')}` : `Made ${summary}.`,
    });
  };

  return (
    <Popover opened={Boolean(error)} position="bottom-start" withArrow width={420}>
      <Popover.Target>
        <Group gap={4} wrap="nowrap" style={{ flex: 1, maxWidth: 640, minWidth: 0 }} visibleFrom="xs">
          <TextInput
            flex={1}
            size="sm"
            radius="xl"
            variant="filled"
            data-testid="command-input"
            aria-label="Recipe"
            placeholder="Type a recipe: 100 spheres → spiral → radius 20"
            value={text}
            error={Boolean(error)}
            onChange={(e) => {
              setText(e.currentTarget.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void run();
              if (e.key === 'Escape') setError(null);
            }}
            leftSection={<IconSparkles size={16} />}
            rightSectionWidth={34}
            rightSection={
              <Menu position="bottom-end" width={430} shadow="md">
                <Menu.Target>
                  <Tooltip label="Example recipes">
                    <ActionIcon variant="subtle" radius="xl" aria-label="Example recipes">
                      <IconChevronDown size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>Click one to try it, then change the numbers!</Menu.Label>
                  {EXAMPLE_COMMANDS.map((c) => (
                    <Menu.Item
                      key={c}
                      onClick={() => {
                        setText(c);
                        void run(c);
                      }}
                    >
                      <Text size="xs" ff="monospace">
                        {c}
                      </Text>
                    </Menu.Item>
                  ))}
                </Menu.Dropdown>
              </Menu>
            }
          />
        </Group>
      </Popover.Target>
      <Popover.Dropdown>
        <Text size="sm" c="red" data-testid="command-error">
          {error}
        </Text>
      </Popover.Dropdown>
    </Popover>
  );
}
