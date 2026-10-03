import {
  Anchor,
  Badge,
  Button,
  Group,
  Modal,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Title,
  useMantineColorScheme,
} from '@mantine/core';
import { IconBox, IconDatabase, IconInfoCircle, IconPalette, IconUser } from '@tabler/icons-react';
import { type ReactNode, useState } from 'react';

import type { Units } from '../engine/types';
import { GEOMETRY_API_URL } from '../services/geometryApi';
import { AUTOSAVE_KEY } from '../state/persistence';
import { useProjectStore } from '../state/projectStore';
import { useUiStore } from '../state/uiStore';
import { BRAND } from '../theme';
import { ColorPicker } from './inspector/LookTab';
import { Logo } from './Logo';
import { notifications } from './notify';

const HOME_URL = (import.meta.env.VITE_HOME_URL as string | undefined) ?? './landing/';

/** One setting: its name and explanation on the left, the control on the right. */
function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <Group justify="space-between" wrap="nowrap" gap="lg" py={10} className="mm-setting-row">
      <div style={{ minWidth: 0 }}>
        <Text size="sm" fw={500}>
          {label}
        </Text>
        {hint && (
          <Text size="xs" c="dimmed">
            {hint}
          </Text>
        )}
      </div>
      <div style={{ flex: 'none' }}>{children}</div>
    </Group>
  );
}

function ProjectSettings() {
  const project = useProjectStore((s) => s.project);
  const updateProject = useProjectStore((s) => s.updateProject);
  return (
    <Stack gap={0}>
      <Row label="Project name">
        <TextInput
          size="xs"
          w={220}
          aria-label="Project name"
          value={project.name}
          onChange={(e) => updateProject((p) => void (p.name = e.currentTarget.value))}
        />
      </Row>
      <Row label="Made by" hint="Shown on the PDF project sheet.">
        <TextInput
          size="xs"
          w={220}
          aria-label="Made by"
          placeholder="Your name"
          value={project.author}
          onChange={(e) => updateProject((p) => void (p.author = e.currentTarget.value))}
        />
      </Row>
      <Row label="Units" hint="What one grid square means.">
        <Select
          size="xs"
          w={220}
          aria-label="Units"
          data={[
            { value: 'mm', label: 'Millimetres (mm)' },
            { value: 'cm', label: 'Centimetres (cm)' },
            { value: 'm', label: 'Metres (m)' },
          ]}
          value={project.units}
          allowDeselect={false}
          onChange={(v) => v && updateProject((p) => void (p.units = v as Units))}
        />
      </Row>
    </Stack>
  );
}

function AppearanceSettings() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const background = useProjectStore((s) => s.project.background);
  const updateProject = useProjectStore((s) => s.updateProject);
  return (
    <Stack gap={0}>
      <Row label="Theme" hint="System follows your device.">
        <SegmentedControl
          size="xs"
          radius="xl"
          aria-label="Theme"
          value={colorScheme}
          onChange={(v) => setColorScheme(v as 'auto' | 'light' | 'dark')}
          data={[
            { value: 'auto', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </Row>
      <Row label="3D view background" hint="Saved with this project.">
        <Group gap={6} wrap="nowrap">
          <div style={{ width: 150 }}>
            <ColorPicker
              label=""
              value={background}
              onChange={(c) => updateProject((p) => void (p.background = c))}
            />
          </div>
          <Button
            size="xs"
            variant="subtle"
            onClick={() => updateProject((p) => void (p.background = BRAND.canvas))}
          >
            Reset
          </Button>
        </Group>
      </Row>
    </Stack>
  );
}

function ViewSettings() {
  const prefs = useUiStore((s) => s.prefs);
  const setPrefs = useUiStore((s) => s.setPrefs);
  const snap = useUiStore((s) => s.snap);
  const setSnap = useUiStore((s) => s.setSnap);
  return (
    <Stack gap={0}>
      <Row label="Show the grid" hint="The floor lines. Each small square is one unit.">
        <Switch
          aria-label="Show the grid"
          checked={prefs.showGrid}
          onChange={(e) => setPrefs({ showGrid: e.currentTarget.checked })}
        />
      </Row>
      <Row label="Show the axes" hint="The X, Y, Z compass in the corner.">
        <Switch
          aria-label="Show the axes"
          checked={prefs.showAxes}
          onChange={(e) => setPrefs({ showAxes: e.currentTarget.checked })}
        />
      </Row>
      <Row label="Snap to grid" hint="Moves go in whole steps when you drag.">
        <Switch aria-label="Snap to grid" checked={snap} onChange={(e) => setSnap(e.currentTarget.checked)} />
      </Row>
      <Row label="Sidebar" hint="Fold it to a strip of icons for a bigger view.">
        <Switch
          aria-label="Show the full sidebar"
          checked={!prefs.navCollapsed}
          onChange={(e) => setPrefs({ navCollapsed: !e.currentTarget.checked })}
        />
      </Row>
      <Row label="Details panel" hint="The settings for the selected object, on the right.">
        <Switch
          aria-label="Show the details panel"
          checked={!prefs.asideHidden}
          onChange={(e) => setPrefs({ asideHidden: !e.currentTarget.checked })}
        />
      </Row>
    </Stack>
  );
}

function DataSettings() {
  const serviceOnline = useUiStore((s) => s.serviceOnline);
  const showTour = useUiStore((s) => s.showTour);
  const setOpen = useUiStore((s) => s.setOpen);
  const [confirming, setConfirming] = useState(false);
  return (
    <Stack gap={0}>
      <Row label="Autosave" hint="Your work is saved in this browser as you go.">
        <Badge variant="light" color="violet">
          On
        </Badge>
      </Row>
      <Row
        label="Geometry service"
        hint={`Needed for Join / Cut / Overlap and print-ready files. Address: ${GEOMETRY_API_URL}`}
      >
        <Badge
          variant="light"
          color={serviceOnline ? 'teal' : serviceOnline === false ? 'gray' : 'yellow'}
          data-testid="settings-service"
        >
          {serviceOnline ? 'Connected' : serviceOnline === false ? 'Offline' : 'Checking…'}
        </Badge>
      </Row>
      <Row label="Welcome tour" hint="The three-step introduction.">
        <Button
          size="xs"
          variant="default"
          onClick={() => {
            setOpen('settingsOpen', false);
            showTour();
          }}
        >
          Show again
        </Button>
      </Row>
      <Row
        label="Clear saved work"
        hint="Removes the autosaved project from this browser. Save a project file first if you want to keep it."
      >
        {confirming ? (
          <Group gap={6} wrap="nowrap">
            <Button size="xs" variant="default" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
            <Button
              size="xs"
              color="red"
              onClick={() => {
                try {
                  localStorage.removeItem(AUTOSAVE_KEY);
                } catch {
                  /* nothing saved */
                }
                setConfirming(false);
                notifications.show({
                  message: 'Cleared. The scene stays on screen until you reload or change it.',
                });
              }}
            >
              Clear
            </Button>
          </Group>
        ) : (
          <Button size="xs" variant="default" color="red" onClick={() => setConfirming(true)}>
            Clear…
          </Button>
        )}
      </Row>
    </Stack>
  );
}

function AboutSettings() {
  return (
    <Stack gap="sm">
      <Group gap="sm" c="violet">
        <Logo size={44} />
        <div>
          <Title order={4} c="var(--mantine-color-text)">
            MathMe 3D Studio
          </Title>
          <Text size="xs" c="dimmed">
            Generative 3D Art &amp; Object Studio · by AL-Majeed Group
          </Text>
        </div>
      </Group>
      <Text size="sm">
        Build 3D art from simple shapes and maths patterns, see the formulas, and export GLB, STL, OBJ, PNG or
        PDF.
      </Text>
      <Anchor href={HOME_URL} size="sm">
        MathMe home page
      </Anchor>
      <Text size="xs" c="dimmed">
        Heart model: Human Reference Atlas, HuBMAP consortium (CC BY 4.0). 3D text font: Droid Sans (Apache
        2.0).
      </Text>
    </Stack>
  );
}

const SECTIONS = [
  { value: 'project', label: 'Project', icon: IconUser, render: () => <ProjectSettings /> },
  { value: 'appearance', label: 'Appearance', icon: IconPalette, render: () => <AppearanceSettings /> },
  { value: 'view', label: '3D view', icon: IconBox, render: () => <ViewSettings /> },
  { value: 'data', label: 'Data', icon: IconDatabase, render: () => <DataSettings /> },
  { value: 'about', label: 'About', icon: IconInfoCircle, render: () => <AboutSettings /> },
];

export function SettingsModal() {
  const open = useUiStore((s) => s.settingsOpen);
  const setOpen = useUiStore((s) => s.setOpen);
  const [tab, setTab] = useState('project');
  return (
    <Modal
      opened={open}
      onClose={() => setOpen('settingsOpen', false)}
      title="Settings"
      size={720}
      centered
      radius="lg"
      classNames={{ title: 'mm-modal-title' }}
      data-testid="settings"
    >
      <Tabs
        value={tab}
        onChange={(v) => v && setTab(v)}
        orientation="vertical"
        variant="pills"
        className="mm-settings-tabs"
        keepMounted={false}
      >
        <Tabs.List>
          {SECTIONS.map((s) => (
            <Tabs.Tab key={s.value} value={s.value} leftSection={<s.icon size={16} />}>
              {s.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {SECTIONS.map((s) => (
          <Tabs.Panel key={s.value} value={s.value}>
            {s.render()}
          </Tabs.Panel>
        ))}
      </Tabs>
    </Modal>
  );
}
