import { ActionIcon, Burger, Button, Group, Text, Tooltip } from '@mantine/core';
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconBulb,
  IconDownload,
  IconHelp,
  IconAdjustments,
} from '@tabler/icons-react';
import { useStore } from 'zustand';

import { redo, undo, useProjectStore } from '../state/projectStore';
import { useUiStore } from '../state/uiStore';
import { CommandBar } from './CommandBar';
import { FileMenu } from './FileMenu';

export function TopBar() {
  const canUndo = useStore(useProjectStore.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useProjectStore.temporal, (s) => s.futureStates.length > 0);
  const setOpen = useUiStore((s) => s.setOpen);
  const navOpen = useUiStore((s) => s.navOpen);
  const asideOpen = useUiStore((s) => s.asideOpen);

  return (
    <Group h="100%" px="sm" gap="sm" wrap="nowrap" justify="space-between">
      <Group gap="xs" wrap="nowrap">
        <Burger
          opened={navOpen}
          onClick={() => setOpen('navOpen', !navOpen)}
          hiddenFrom="sm"
          size="sm"
          aria-label="Shapes and patterns"
        />
        <img src="./favicon.svg" width={28} height={28} alt="" />
        <Text fw={800} size="lg" visibleFrom="md" style={{ whiteSpace: 'nowrap' }}>
          MathMe 3D Studio
        </Text>
        <FileMenu />
      </Group>
      <CommandBar />
      <Group gap={6} wrap="nowrap">
        <Tooltip label="Undo (Ctrl+Z)">
          <ActionIcon variant="default" size="lg" onClick={undo} disabled={!canUndo} aria-label="Undo">
            <IconArrowBackUp size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Redo (Ctrl+Y)">
          <ActionIcon variant="default" size="lg" onClick={redo} disabled={!canRedo} aria-label="Redo">
            <IconArrowForwardUp size={18} />
          </ActionIcon>
        </Tooltip>
        <Button
          variant="light"
          leftSection={<IconBulb size={16} />}
          onClick={() => setOpen('presetsOpen', true)}
          visibleFrom="xs"
        >
          Ideas
        </Button>
        <Button
          leftSection={<IconDownload size={16} />}
          onClick={() => setOpen('exportOpen', true)}
          data-testid="open-export"
        >
          Export
        </Button>
        <Tooltip label="Help">
          <ActionIcon variant="subtle" size="lg" onClick={() => setOpen('helpOpen', true)} aria-label="Help">
            <IconHelp size={18} />
          </ActionIcon>
        </Tooltip>
        <ActionIcon
          variant="subtle"
          size="lg"
          hiddenFrom="md"
          onClick={() => setOpen('asideOpen', !asideOpen)}
          aria-label="Settings panel"
        >
          <IconAdjustments size={18} />
        </ActionIcon>
      </Group>
    </Group>
  );
}
