import { ActionIcon, Collapse, Group, ScrollArea, Stack, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconBulb,
  IconChevronRight,
  IconCube,
  IconHelp,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconListTree,
  IconSettings,
  IconSpiral,
  IconSquarePlus,
  IconX,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';

import { emptyProject } from '../engine/project/defaults';
import { type Prefs, useUiStore } from '../state/uiStore';
import { loadProject } from './actions';
import { Logo } from './Logo';
import { notifications } from './notify';
import { NavRow } from './NavRow';
import { Outliner } from './Outliner';
import { PatternPicker } from './PatternPicker';
import { ShapeLibrary } from './ShapeLibrary';

/** True on screens wide enough for the sidebar to sit beside the 3D view. */
export function useWideScreen() {
  return useMediaQuery('(min-width: 48em)', true) ?? true;
}

export function newScene() {
  loadProject(emptyProject());
  notifications.show({ message: 'New empty scene. Press Undo to get the old one back.' });
}

function Section({
  id,
  title,
  children,
}: {
  id: keyof Prefs['sections'];
  title: string;
  children: ReactNode;
}) {
  const open = useUiStore((s) => s.prefs.sections[id]);
  const toggle = useUiStore((s) => s.toggleSection);
  return (
    <div>
      <UnstyledButton
        className="mm-section-head"
        onClick={() => toggle(id)}
        aria-expanded={open}
        data-testid={`section-${id}`}
      >
        <span>{title}</span>
        <IconChevronRight size={14} className="mm-chevron" data-open={open || undefined} aria-hidden />
      </UnstyledButton>
      <Collapse expanded={open} transitionDuration={120}>
        <div className="mm-section-body">{children}</div>
      </Collapse>
    </div>
  );
}

export function Sidebar() {
  const wide = useWideScreen();
  const collapsed = useUiStore((s) => s.prefs.navCollapsed) && wide;
  return collapsed ? <SidebarRail /> : <SidebarFull wide={wide} />;
}

function SidebarFull({ wide }: { wide: boolean }) {
  const setPrefs = useUiStore((s) => s.setPrefs);
  const setOpen = useUiStore((s) => s.setOpen);
  return (
    <Stack gap={0} h="100%" className="mm-sidebar">
      <Group justify="space-between" wrap="nowrap" px={12} pt={10} pb={6}>
        <Group gap={8} wrap="nowrap" c="violet">
          <Logo size={28} />
          <Text className="mm-wordmark" c="var(--mantine-color-text)">
            MATHME
          </Text>
        </Group>
        {!wide && (
          <ActionIcon size="lg" onClick={() => setOpen('navOpen', false)} aria-label="Close sidebar">
            <IconX size={19} />
          </ActionIcon>
        )}
        {wide && (
          <Tooltip label="Hide sidebar" position="right">
            <ActionIcon size="lg" onClick={() => setPrefs({ navCollapsed: true })} aria-label="Hide sidebar">
              <IconLayoutSidebarLeftCollapse size={19} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
      <Stack gap={1} px={8} pb={6}>
        <NavRow icon={<IconSquarePlus size={18} />} label="New scene" onClick={newScene} />
        <NavRow icon={<IconBulb size={18} />} label="Ideas" onClick={() => setOpen('presetsOpen', true)} />
      </Stack>
      <ScrollArea flex={1} type="auto" scrollbarSize={6}>
        <Stack gap={4} px={8} pb="md">
          <Section id="shapes" title="Add a shape">
            <ShapeLibrary />
          </Section>
          <Section id="patterns" title="Make a pattern">
            <PatternPicker />
          </Section>
          <Section id="scene" title="In your scene">
            <Outliner />
          </Section>
        </Stack>
      </ScrollArea>
      <Stack gap={1} px={8} py={8} className="mm-sidebar-foot">
        <NavRow icon={<IconHelp size={18} />} label="Help" onClick={() => setOpen('helpOpen', true)} />
        <NavRow
          icon={<IconSettings size={18} />}
          label="Settings"
          onClick={() => setOpen('settingsOpen', true)}
          testId="open-settings"
        />
      </Stack>
    </Stack>
  );
}

function RailButton({ label, icon, onClick }: { label: string; icon: ReactNode; onClick(): void }) {
  return (
    <Tooltip label={label} position="right" withArrow>
      <ActionIcon size={40} radius="md" onClick={onClick} aria-label={label}>
        {icon}
      </ActionIcon>
    </Tooltip>
  );
}

/** The sidebar folded to a strip of icons. Any of them opens it again. */
function SidebarRail() {
  const setPrefs = useUiStore((s) => s.setPrefs);
  const setOpen = useUiStore((s) => s.setOpen);
  const toggleSection = useUiStore((s) => s.toggleSection);
  const openAt = (section: keyof Prefs['sections']) => {
    toggleSection(section, true);
    setPrefs({ navCollapsed: false });
  };
  return (
    <Stack gap={4} h="100%" align="center" py={10} className="mm-sidebar">
      <Tooltip label="Show sidebar" position="right" withArrow>
        <UnstyledButton
          className="mm-rail-logo"
          onClick={() => setPrefs({ navCollapsed: false })}
          aria-label="Show sidebar"
        >
          <span className="mm-rail-logo-mark">
            <Logo size={28} />
          </span>
          <span className="mm-rail-logo-open">
            <IconLayoutSidebarLeftExpand size={20} />
          </span>
        </UnstyledButton>
      </Tooltip>
      <RailButton label="New scene" icon={<IconSquarePlus size={19} />} onClick={newScene} />
      <RailButton label="Ideas" icon={<IconBulb size={19} />} onClick={() => setOpen('presetsOpen', true)} />
      <RailButton label="Add a shape" icon={<IconCube size={19} />} onClick={() => openAt('shapes')} />
      <RailButton label="Make a pattern" icon={<IconSpiral size={19} />} onClick={() => openAt('patterns')} />
      <RailButton label="In your scene" icon={<IconListTree size={19} />} onClick={() => openAt('scene')} />
      <div style={{ flex: 1 }} />
      <RailButton label="Help" icon={<IconHelp size={19} />} onClick={() => setOpen('helpOpen', true)} />
      <RailButton
        label="Settings"
        icon={<IconSettings size={19} />}
        onClick={() => setOpen('settingsOpen', true)}
      />
    </Stack>
  );
}
