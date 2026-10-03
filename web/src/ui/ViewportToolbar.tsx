import { ActionIcon, Badge, Group, Paper, SegmentedControl, Switch, Tooltip } from '@mantine/core';
import { IconArrowsMove, IconFocus2, IconResize, IconRotate, IconScissors } from '@tabler/icons-react';
import { useMemo } from 'react';

import { countObjects } from '../engine/evaluate';
import { WARN_OBJECTS } from '../engine/layout';
import { fmtCount } from '../engine/math';
import { useProjectStore } from '../state/projectStore';
import { useUiStore, type TransformMode } from '../state/uiStore';
import { openCutTool } from './CutPanel';

export function ViewportToolbar() {
  const mode = useUiStore((s) => s.transformMode);
  const setMode = useUiStore((s) => s.setTransformMode);
  const snap = useUiStore((s) => s.snap);
  const setSnap = useUiStore((s) => s.setSnap);
  const requestFrame = useUiStore((s) => s.requestFrame);
  const project = useProjectStore((s) => s.project);
  const count = useMemo(() => countObjects(project), [project]);

  return (
    <Group
      gap="xs"
      style={{ position: 'absolute', left: 12, top: 12, zIndex: 10, pointerEvents: 'none' }}
      wrap="wrap"
    >
      <Paper shadow="sm" radius="md" p={4} style={{ pointerEvents: 'auto' }}>
        <SegmentedControl
          size="xs"
          value={mode}
          onChange={(v) => setMode(v as TransformMode)}
          data={[
            {
              value: 'translate',
              label: (
                <Tooltip label="Move (W)">
                  <IconArrowsMove size={16} aria-label="Move" />
                </Tooltip>
              ),
            },
            {
              value: 'rotate',
              label: (
                <Tooltip label="Turn (E)">
                  <IconRotate size={16} aria-label="Turn" />
                </Tooltip>
              ),
            },
            {
              value: 'scale',
              label: (
                <Tooltip label="Stretch (R)">
                  <IconResize size={16} aria-label="Stretch" />
                </Tooltip>
              ),
            },
          ]}
        />
      </Paper>
      <Paper shadow="sm" radius="md" px="xs" py={6} style={{ pointerEvents: 'auto' }}>
        <Switch size="xs" label="Snap" checked={snap} onChange={(e) => setSnap(e.currentTarget.checked)} />
      </Paper>
      <Paper shadow="sm" radius="md" p={4} style={{ pointerEvents: 'auto' }}>
        <Tooltip label="Fit everything in view (F)">
          <ActionIcon variant="subtle" onClick={requestFrame} aria-label="Fit everything in view">
            <IconFocus2 size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Cut through the model">
          <ActionIcon
            variant="subtle"
            onClick={openCutTool}
            aria-label="Cut through the model"
            data-testid="open-cut"
          >
            <IconScissors size={18} />
          </ActionIcon>
        </Tooltip>
      </Paper>
      <Badge
        size="lg"
        variant="white"
        color={count > WARN_OBJECTS ? 'orange' : 'gray'}
        style={{ pointerEvents: 'auto' }}
        data-testid="object-count"
      >
        {fmtCount(count)} {count === 1 ? 'object' : 'objects'}
      </Badge>
    </Group>
  );
}
