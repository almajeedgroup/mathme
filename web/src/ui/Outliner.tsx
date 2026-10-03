import { ActionIcon, Group, Stack, Text, TextInput, Tooltip, UnstyledButton } from '@mantine/core';
import { IconEye, IconEyeOff, IconTrash } from '@tabler/icons-react';
import { useMemo, useState } from 'react';

import { PATTERNS } from '../engine/patterns/registry';
import { SHAPES } from '../engine/shapes/registry';
import type { SceneNode } from '../engine/types';
import { useProjectStore } from '../state/projectStore';
import { useUiStore } from '../state/uiStore';
import { toggleVisible } from './actions';

function nodeIcon(n: SceneNode): string {
  if (n.kind === 'group') return '📁';
  if (n.kind === 'pattern') return PATTERNS[n.pattern.type].icon;
  return n.source.kind === 'shape' ? SHAPES[n.source.shape.type].icon : '🧩';
}

export function Outliner() {
  const nodes = useProjectStore((s) => s.project.nodes);
  const byParent = useMemo(() => {
    const m = new Map<string | null, SceneNode[]>();
    for (const n of nodes) m.set(n.parentId, [...(m.get(n.parentId) ?? []), n]);
    return m;
  }, [nodes]);
  return (
    <Stack gap={4}>
      <Text fw={700} size="sm">
        In your scene
      </Text>
      {nodes.length === 0 ? (
        <Text size="xs" c="dimmed">
          Nothing yet. Add a shape above or try a ready-made idea.
        </Text>
      ) : (
        <Stack gap={1} role="tree" aria-label="Scene objects">
          {(byParent.get(null) ?? []).map((n) => (
            <OutlinerRow key={n.id} node={n} depth={0} byParent={byParent} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function OutlinerRow({
  node,
  depth,
  byParent,
}: {
  node: SceneNode;
  depth: number;
  byParent: Map<string | null, SceneNode[]>;
}) {
  const selected = useUiStore((s) => s.selectedIds.includes(node.id));
  const select = useUiStore((s) => s.select);
  const updateNode = useProjectStore((s) => s.updateNode);
  const removeNodes = useProjectStore((s) => s.removeNodes);
  const [editing, setEditing] = useState(false);
  const children = byParent.get(node.id) ?? [];
  const detail =
    node.kind === 'pattern' ? `${node.count}` : node.kind === 'group' ? `${children.length}` : '';

  return (
    <>
      <Group
        gap={4}
        wrap="nowrap"
        role="treeitem"
        aria-selected={selected}
        pl={depth * 14}
        style={{
          borderRadius: 6,
          background: selected ? 'var(--mantine-primary-color-light)' : undefined,
        }}
      >
        <UnstyledButton
          flex={1}
          py={3}
          px={4}
          onClick={(e) => select(node.id, { additive: e.shiftKey || e.ctrlKey || e.metaKey })}
          onDoubleClick={() => setEditing(true)}
          style={{ minWidth: 0, opacity: node.visible ? 1 : 0.45 }}
          data-testid="outliner-row"
        >
          <Group gap={6} wrap="nowrap">
            <span aria-hidden>{nodeIcon(node)}</span>
            {editing ? (
              <TextInput
                size="xs"
                autoFocus
                defaultValue={node.name}
                onBlur={(e) => {
                  const name = e.currentTarget.value.trim();
                  if (name) updateNode(node.id, (n) => void (n.name = name));
                  setEditing(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();
                }}
              />
            ) : (
              <Text size="sm" truncate>
                {node.name}
              </Text>
            )}
            {detail && (
              <Text size="xs" c="dimmed">
                {detail}
              </Text>
            )}
          </Group>
        </UnstyledButton>
        <Tooltip label={node.visible ? 'Hide' : 'Show'}>
          <ActionIcon
            size="sm"
            variant="subtle"
            color="gray"
            onClick={() => toggleVisible(node.id)}
            aria-label={node.visible ? `Hide ${node.name}` : `Show ${node.name}`}
          >
            {node.visible ? <IconEye size={14} /> : <IconEyeOff size={14} />}
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Delete">
          <ActionIcon
            size="sm"
            variant="subtle"
            color="red"
            onClick={() => removeNodes([node.id])}
            aria-label={`Delete ${node.name}`}
          >
            <IconTrash size={14} />
          </ActionIcon>
        </Tooltip>
      </Group>
      {children.map((c) => (
        <OutlinerRow key={c.id} node={c} depth={depth + 1} byParent={byParent} />
      ))}
    </>
  );
}
