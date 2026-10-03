import { ActionIcon, Group, ScrollArea, Stack, Tabs, Text, TextInput, Tooltip } from '@mantine/core';
import { IconCopy, IconLayoutSidebarRightCollapse, IconTrash } from '@tabler/icons-react';

import type { SceneNode } from '../../engine/types';
import { useProjectStore } from '../../state/projectStore';
import { useUiStore } from '../../state/uiStore';
import { deleteSelection, duplicateSelection } from '../actions';
import { GroupTab } from './GroupTab';
import { LearnTab } from './LearnTab';
import { LookTab } from './LookTab';
import { MeasureTab } from './MeasureTab';
import { MirrorTab } from './MirrorTab';
import { MultiTab } from './MultiTab';
import { PatternTab } from './PatternTab';
import { PlaceTab } from './PlaceTab';
import { ProjectTab } from './ProjectTab';
import { ShapeTab } from './ShapeTab';
import { VaryTab } from './VaryTab';

interface TabDef {
  value: string;
  label: string;
  render(): React.ReactNode;
}

function tabsFor(node: SceneNode): TabDef[] {
  if (node.kind === 'group') {
    return [
      { value: 'group', label: 'Group', render: () => <GroupTab node={node} /> },
      { value: 'place', label: 'Move', render: () => <PlaceTab node={node} /> },
      { value: 'mirror', label: 'Mirror', render: () => <MirrorTab node={node} /> },
    ];
  }
  if (node.kind === 'object') {
    return [
      { value: 'shape', label: 'Shape', render: () => <ShapeTab node={node} /> },
      { value: 'look', label: 'Colour', render: () => <LookTab node={node} /> },
      { value: 'place', label: 'Move', render: () => <PlaceTab node={node} /> },
      { value: 'mirror', label: 'Mirror', render: () => <MirrorTab node={node} /> },
      { value: 'measure', label: 'Measure', render: () => <MeasureTab node={node} /> },
    ];
  }
  return [
    { value: 'pattern', label: 'Pattern', render: () => <PatternTab node={node} /> },
    { value: 'shape', label: 'Shape', render: () => <ShapeTab node={node} /> },
    { value: 'vary', label: 'Vary', render: () => <VaryTab node={node} /> },
    { value: 'look', label: 'Colour', render: () => <LookTab node={node} /> },
    { value: 'learn', label: 'Learn', render: () => <LearnTab node={node} /> },
    { value: 'measure', label: 'Measure', render: () => <MeasureTab node={node} /> },
    { value: 'mirror', label: 'Mirror', render: () => <MirrorTab node={node} /> },
    { value: 'place', label: 'Move', render: () => <PlaceTab node={node} /> },
  ];
}

export function Inspector({ onHide }: { onHide(): void }) {
  const ids = useUiStore((s) => s.selectedIds);
  const nodes = useProjectStore((s) => s.project.nodes);
  const selected = ids.map((id) => nodes.find((n) => n.id === id)).filter((n): n is SceneNode => Boolean(n));
  return (
    <Stack gap={0} h="100%">
      <Group justify="space-between" wrap="nowrap" px="sm" pt={10} pb={2}>
        <Text className="mm-label">Details</Text>
        <Tooltip label="Hide details panel" position="left">
          <ActionIcon size="lg" onClick={onHide} aria-label="Hide details panel">
            <IconLayoutSidebarRightCollapse size={19} />
          </ActionIcon>
        </Tooltip>
      </Group>
      <ScrollArea flex={1} type="auto" offsetScrollbars>
        <Stack p="sm" pt={4} gap="sm" data-testid="inspector">
          {selected.length === 0 ? (
            <ProjectTab />
          ) : selected.length > 1 ? (
            <MultiTab nodes={selected} />
          ) : (
            <NodeInspector node={selected[0]} />
          )}
        </Stack>
      </ScrollArea>
    </Stack>
  );
}

function NodeInspector({ node }: { node: SceneNode }) {
  const updateNode = useProjectStore((s) => s.updateNode);
  const tab = useUiStore((s) => s.inspectorTab);
  const setTab = useUiStore((s) => s.setInspectorTab);
  const tabs = tabsFor(node);
  const active = tabs.find((t) => t.value === tab) ?? tabs[0];
  return (
    <>
      <Group gap="xs" wrap="nowrap">
        <TextInput
          flex={1}
          size="sm"
          variant="unstyled"
          styles={{ input: { fontFamily: 'Urbanist, "DM Sans", sans-serif', fontWeight: 800, fontSize: 18 } }}
          aria-label="Name"
          value={node.name}
          onChange={(e) => {
            const name = e.currentTarget.value;
            updateNode(node.id, (n) => void (n.name = name));
          }}
        />
        <Tooltip label="Duplicate (Ctrl+D)">
          <ActionIcon onClick={duplicateSelection} aria-label="Duplicate">
            <IconCopy size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Delete (Del)">
          <ActionIcon onClick={deleteSelection} aria-label="Delete">
            <IconTrash size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
      <Tabs value={active.value} onChange={setTab} variant="pills" radius="xl" keepMounted={false}>
        <Tabs.List mb="sm" style={{ gap: 4 }}>
          {tabs.map((t) => (
            <Tabs.Tab key={t.value} value={t.value} px={10} py={3} fz="sm" data-testid={`tab-${t.value}`}>
              {t.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        <Tabs.Panel value={active.value}>{active.render()}</Tabs.Panel>
      </Tabs>
    </>
  );
}
