import {
  ActionIcon,
  Badge,
  Burger,
  Button,
  Group,
  Menu,
  Modal,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import {
  IconArrowUp,
  IconCopy,
  IconDots,
  IconPencil,
  IconPlus,
  IconSparkles,
  IconTrash,
  IconWriting,
} from '@tabler/icons-react';
import { useState } from 'react';

import { emptyProject } from '../engine/project/defaults';
import { PRESETS } from '../engine/project/presets';
import {
  deleteProject,
  duplicateProject,
  type ProjectMeta,
  renameProject,
  useProjectList,
} from '../state/persistence';
import { useUiStore } from '../state/uiStore';
import { askMathMe } from './assistant';
import { openCutTool } from './CutPanel';
import { Logo } from './Logo';
import { openProject, startNewProject } from './navigation';
import { notifications } from './notify';

const SUGGESTIONS = [
  '200 rainbow cubes in a wave',
  '500 spheres in a sunflower',
  'DNA double helix',
  '12 stars in a circle, radius 8',
];

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
function ago(time: number): string {
  const s = (time - Date.now()) / 1000;
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [7, 'day'],
    [4.35, 'week'],
    [12, 'month'],
  ];
  let value = s;
  for (const [size, unit] of steps) {
    if (Math.abs(value) < size) return rtf.format(Math.round(value), unit);
    value /= size;
  }
  return rtf.format(Math.round(value), 'year');
}

interface ChatLine {
  who: 'you' | 'mathme';
  text: string;
}

/** The chat box: describe something and MathMe builds it in a new project. */
function ChatBox() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const ai = useUiStore((s) => s.assistantOnline || s.claudeChat);
  const send = async (message = text) => {
    const m = message.trim();
    if (!m || busy) return;
    setBusy(true);
    setLines((l) => [...l, { who: 'you', text: m }]);
    setText('');
    try {
      const result = await askMathMe(m);
      if (result.ok) notifications.show({ color: 'violet', title: 'MathMe', message: result.reply });
      else setLines((l) => [...l, { who: 'mathme', text: result.reply }]);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Stack gap="xs" w="100%">
      {(lines.length > 0 || busy) && (
        <Stack gap={6} className="mm-chat-lines" data-testid="chat-lines">
          {lines.slice(-4).map((l, i) => (
            <Text key={i} size="sm" className={l.who === 'you' ? 'mm-bubble-you' : 'mm-bubble-bot'}>
              {l.text}
            </Text>
          ))}
          {busy && (
            <Text size="sm" c="dimmed" className="mm-bubble-bot">
              Thinking…
            </Text>
          )}
        </Stack>
      )}
      <div className="mm-chatbox">
        <Textarea
          variant="unstyled"
          autosize
          minRows={2}
          maxRows={6}
          px="md"
          pt="sm"
          aria-label="Describe what to make"
          placeholder="Describe a 3D artwork… e.g. “300 cones on a sphere, rainbow”"
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          data-testid="chat-input"
        />
        <Group justify="space-between" px="sm" pb="sm" wrap="nowrap">
          <Group gap={6} wrap="nowrap">
            <Tooltip label="Start a blank project and draw with the pencil">
              <Button
                size="xs"
                variant="default"
                radius="xl"
                leftSection={<IconPencil size={14} />}
                onClick={() => {
                  startNewProject(emptyProject('My drawing'));
                  useUiStore.getState().setDraw({ tool: 'pencil' });
                }}
                data-testid="home-draw"
              >
                Draw
              </Button>
            </Tooltip>
            <Tooltip
              label={
                ai
                  ? 'Claude reads your words and writes MathMe recipes for you.'
                  : 'MathMe reads recipes and simple sentences. Full chat needs Claude: open MathMe on claude.ai, or add an AI key to the geometry service.'
              }
              multiline
              w={260}
            >
              <Badge variant="light" color={ai ? 'violet' : 'gray'} leftSection={<IconSparkles size={12} />}>
                {ai ? 'AI' : 'Recipes'}
              </Badge>
            </Tooltip>
          </Group>
          <ActionIcon
            size="lg"
            radius="xl"
            variant="filled"
            color="violet"
            onClick={() => void send()}
            loading={busy}
            disabled={!text.trim()}
            aria-label="Make it"
            data-testid="chat-send"
          >
            <IconArrowUp size={18} />
          </ActionIcon>
        </Group>
      </div>
      <Group gap={6} justify="center">
        {SUGGESTIONS.map((s) => (
          <Button key={s} size="xs" variant="subtle" radius="xl" color="gray" onClick={() => void send(s)}>
            {s}
          </Button>
        ))}
      </Group>
    </Stack>
  );
}

function ProjectCard({ meta, onRename }: { meta: ProjectMeta; onRename(meta: ProjectMeta): void }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="mm-project">
      <UnstyledButton
        className="mm-project-open"
        onClick={() => openProject(meta.id)}
        aria-label={`Open ${meta.name}`}
        data-testid="project-card"
      >
        <div className="mm-project-thumb">
          {meta.thumb ? <img src={meta.thumb} alt="" /> : <Logo size={40} />}
        </div>
        <div className="mm-project-meta">
          <Text size="sm" fw={600} truncate>
            {meta.name || 'Untitled'}
          </Text>
          <Text size="xs" c="dimmed">
            {ago(meta.updatedAt)} · {meta.objects} {meta.objects === 1 ? 'object' : 'objects'}
          </Text>
        </div>
      </UnstyledButton>
      <Menu position="bottom-end" width={170}>
        <Menu.Target>
          <ActionIcon className="mm-project-menu" aria-label={`More for ${meta.name}`} radius="xl">
            <IconDots size={16} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item leftSection={<IconWriting size={14} />} onClick={() => onRename(meta)}>
            Rename
          </Menu.Item>
          <Menu.Item leftSection={<IconCopy size={14} />} onClick={() => duplicateProject(meta.id)}>
            Duplicate
          </Menu.Item>
          <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => setConfirm(true)}>
            Delete
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <Modal
        opened={confirm}
        onClose={() => setConfirm(false)}
        title="Delete this project?"
        centered
        size="sm"
      >
        <Text size="sm" mb="md">
          “{meta.name}” will be removed from this browser. This cannot be undone.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setConfirm(false)}>
            Keep it
          </Button>
          <Button
            color="red"
            onClick={() => {
              deleteProject(meta.id);
              setConfirm(false);
            }}
          >
            Delete
          </Button>
        </Group>
      </Modal>
    </div>
  );
}

function RenameModal({ meta, onClose }: { meta: ProjectMeta; onClose(): void }) {
  const [name, setName] = useState(meta.name);
  return (
    <Modal opened onClose={onClose} title="Rename project" centered size="sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) renameProject(meta.id, name.trim());
          onClose();
        }}
      >
        <TextInput
          data-autofocus
          label="Name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          mb="md"
        />
        <Group justify="flex-end">
          <Button type="submit">Save</Button>
        </Group>
      </form>
    </Modal>
  );
}

function openIdea(id: string) {
  if (id === 'heart') {
    void import('../services/modelAssets').then(async ({ buildHeartProject }) => {
      startNewProject(await buildHeartProject());
      setTimeout(openCutTool, 400);
    });
    return;
  }
  const preset = PRESETS.find((p) => p.id === id);
  if (preset) startNewProject(preset.build());
}

export function HomePage() {
  const items = useProjectList((s) => s.items);
  const navOpen = useUiStore((s) => s.navOpen);
  const setOpen = useUiStore((s) => s.setOpen);
  const [renaming, setRenaming] = useState<ProjectMeta | null>(null);
  return (
    <ScrollArea h="100dvh" type="auto" data-testid="home">
      <Burger
        opened={navOpen}
        onClick={() => setOpen('navOpen', !navOpen)}
        hiddenFrom="sm"
        size="sm"
        m="sm"
        aria-label="Projects menu"
      />
      <Stack maw={880} mx="auto" px="md" pt={{ base: 8, sm: 72 }} pb={64} gap={48} align="stretch">
        <Stack gap="lg" align="center">
          <Group gap="sm" c="violet" wrap="nowrap">
            <Logo size={40} />
            <Title order={1} className="mm-home-title" c="var(--mantine-color-text)">
              What shall we make today?
            </Title>
          </Group>
          <Text c="dimmed" ta="center" maw={560}>
            Describe it, draw it with the pencil, or pick up a project where you left off.
          </Text>
          <ChatBox />
        </Stack>

        <Stack gap="sm">
          <Group justify="space-between">
            <Text className="mm-label">Your projects</Text>
            <Text size="xs" c="dimmed">
              Saved in this browser
            </Text>
          </Group>
          <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="md">
            <UnstyledButton
              className="mm-project mm-project-new"
              onClick={() => startNewProject()}
              data-testid="home-new-project"
            >
              <IconPlus size={22} />
              <Text size="sm" fw={600}>
                New project
              </Text>
            </UnstyledButton>
            {items.map((m) => (
              <ProjectCard key={m.id} meta={m} onRename={setRenaming} />
            ))}
          </SimpleGrid>
        </Stack>

        <Stack gap="sm">
          <Text className="mm-label">Start from an idea</Text>
          <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="xs">
            {[
              ...PRESETS.map((p) => ({ id: p.id, icon: p.icon, title: p.title })),
              { id: 'heart', icon: '🫀', title: 'Human heart' },
            ].map((p) => (
              <UnstyledButton
                key={p.id}
                className="mm-idea"
                onClick={() => openIdea(p.id)}
                data-testid={`home-idea-${p.id}`}
              >
                <span className="tile-icon" aria-hidden>
                  {p.icon}
                </span>
                <Text size="sm" truncate>
                  {p.title}
                </Text>
              </UnstyledButton>
            ))}
          </SimpleGrid>
        </Stack>
      </Stack>
      {renaming && <RenameModal key={renaming.id} meta={renaming} onClose={() => setRenaming(null)} />}
    </ScrollArea>
  );
}
