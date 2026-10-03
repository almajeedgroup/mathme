import { ActionIcon, Burger, Button, Group, Text, Tooltip } from '@mantine/core';
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconBulb,
  IconDownload,
  IconHelp,
  IconHome,
  IconAdjustments,
} from '@tabler/icons-react';
import { useStore } from 'zustand';

import { redo, undo, useProjectStore } from '../state/projectStore';
import { useUiStore } from '../state/uiStore';
import { CommandBar } from './CommandBar';
import { FileMenu } from './FileMenu';

// The landing page ships next to the app (landing/index.html); hosts can point elsewhere.
const HOME_URL = (import.meta.env.VITE_HOME_URL as string | undefined) ?? './landing/';

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
        <img src="./favicon.svg" width={26} height={26} alt="" />
        <Text className="mm-wordmark" visibleFrom="md" aria-label="MathMe 3D Studio">
          MATHME
        </Text>
        <Tooltip label="MathMe home page">
          <ActionIcon component="a" href={HOME_URL} size="lg" aria-label="Home page">
            <IconHome size={18} />
          </ActionIcon>
        </Tooltip>
        <FileMenu />
      </Group>
      <CommandBar />
      <Group gap={6} wrap="nowrap">
        <Tooltip label="Undo (Ctrl+Z)">
          <ActionIcon size="lg" onClick={undo} disabled={!canUndo} aria-label="Undo">
            <IconArrowBackUp size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Redo (Ctrl+Y)">
          <ActionIcon size="lg" onClick={redo} disabled={!canRedo} aria-label="Redo">
            <IconArrowForwardUp size={18} />
          </ActionIcon>
        </Tooltip>
        <Button
          variant="subtle"
          color="gray"
          leftSection={<IconBulb size={16} />}
          onClick={() => setOpen('presetsOpen', true)}
          visibleFrom="xs"
        >
          Ideas
        </Button>
        <Button
          className="mm-cta"
          leftSection={<IconDownload size={16} />}
          onClick={() => setOpen('exportOpen', true)}
          data-testid="open-export"
        >
          Export
        </Button>
        <Tooltip label="Help">
          <ActionIcon size="lg" onClick={() => setOpen('helpOpen', true)} aria-label="Help">
            <IconHelp size={18} />
          </ActionIcon>
        </Tooltip>
        <ActionIcon
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
