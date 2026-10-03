import { ActionIcon, Burger, Button, Group, Tooltip } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconDownload,
  IconHome,
  IconLayoutSidebarRightExpand,
} from '@tabler/icons-react';
import { useStore } from 'zustand';

import { redo, undo, useProjectStore } from '../state/projectStore';
import { useUiStore } from '../state/uiStore';
import { CommandBar } from './CommandBar';
import { FileMenu } from './FileMenu';
import { Logo } from './Logo';

// The landing page ships next to the app (landing/index.html); hosts can point elsewhere.
const HOME_URL = (import.meta.env.VITE_HOME_URL as string | undefined) ?? './landing/';

/** True when the details panel sits beside the 3D view instead of over it. */
export function useWideAside() {
  return useMediaQuery('(min-width: 62em)', true) ?? true;
}

/** Show or hide the right-hand details panel, on any screen size. */
export function useDetailsPanel() {
  const wide = useWideAside();
  const hidden = useUiStore((s) => s.prefs.asideHidden);
  const asideOpen = useUiStore((s) => s.asideOpen);
  const setPrefs = useUiStore((s) => s.setPrefs);
  const setOpen = useUiStore((s) => s.setOpen);
  const shown = wide ? !hidden : asideOpen;
  const setShown = (show: boolean) => (wide ? setPrefs({ asideHidden: !show }) : setOpen('asideOpen', show));
  return { shown, setShown };
}

export function TopBar() {
  const canUndo = useStore(useProjectStore.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useProjectStore.temporal, (s) => s.futureStates.length > 0);
  const setOpen = useUiStore((s) => s.setOpen);
  const navOpen = useUiStore((s) => s.navOpen);
  const details = useDetailsPanel();

  return (
    <Group h="100%" px="sm" gap="sm" wrap="nowrap" justify="space-between">
      <Group gap={4} wrap="nowrap">
        <Burger
          opened={navOpen}
          onClick={() => setOpen('navOpen', !navOpen)}
          hiddenFrom="sm"
          size="sm"
          aria-label="Shapes and patterns"
        />
        <Group hiddenFrom="sm" c="violet">
          <Logo size={24} />
        </Group>
        <Tooltip label="MathMe home page">
          <ActionIcon component="a" href={HOME_URL} size="lg" aria-label="Home page">
            <IconHome size={18} />
          </ActionIcon>
        </Tooltip>
        <FileMenu />
      </Group>
      <CommandBar />
      <Group gap={4} wrap="nowrap">
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
          className="mm-cta"
          ml={4}
          leftSection={<IconDownload size={16} />}
          onClick={() => setOpen('exportOpen', true)}
          data-testid="open-export"
        >
          Export
        </Button>
        {!details.shown && (
          <Tooltip label="Show details panel">
            <ActionIcon size="lg" onClick={() => details.setShown(true)} aria-label="Show details panel">
              <IconLayoutSidebarRightExpand size={19} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
    </Group>
  );
}
