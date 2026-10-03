import { ActionIcon, Group, SegmentedControl, Text, Tooltip } from '@mantine/core';
import {
  IconArrowsMove,
  IconFocus2,
  IconMagnet,
  IconPencil,
  IconResize,
  IconRotate,
  IconScissors,
} from '@tabler/icons-react';
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
  const drawing = useUiStore((s) => s.draw.tool !== null);
  const setDraw = useUiStore((s) => s.setDraw);
  const project = useProjectStore((s) => s.project);
  const count = useMemo(() => countObjects(project), [project]);

  return (
    <Group
      gap="xs"
      style={{ position: 'absolute', left: 12, top: 12, zIndex: 10, pointerEvents: 'none' }}
      wrap="wrap"
    >
      <Group gap={2} p={4} wrap="nowrap" className="mm-float">
        <SegmentedControl
          size="xs"
          radius="xl"
          bg="transparent"
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
        <Tooltip label="Draw with the pencil (P)">
          <ActionIcon
            radius="xl"
            variant={drawing ? 'filled' : 'subtle'}
            color={drawing ? 'violet' : 'gray'}
            onClick={() => setDraw({ tool: drawing ? null : 'pencil' })}
            aria-label="Draw with the pencil"
            aria-pressed={drawing}
            data-testid="open-draw"
          >
            <IconPencil size={17} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={snap ? 'Snap to grid: on' : 'Snap to grid: off'}>
          <ActionIcon
            radius="xl"
            variant={snap ? 'light' : 'subtle'}
            color={snap ? 'violet' : 'gray'}
            onClick={() => setSnap(!snap)}
            aria-label="Snap to grid"
            aria-pressed={snap}
          >
            <IconMagnet size={17} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Fit everything in view (F)">
          <ActionIcon radius="xl" onClick={requestFrame} aria-label="Fit everything in view">
            <IconFocus2 size={17} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Cut through the model">
          <ActionIcon
            radius="xl"
            onClick={openCutTool}
            aria-label="Cut through the model"
            data-testid="open-cut"
          >
            <IconScissors size={17} />
          </ActionIcon>
        </Tooltip>
      </Group>
      <Text
        size="xs"
        fw={600}
        px={6}
        c={count > WARN_OBJECTS ? 'orange' : 'dimmed'}
        style={{ pointerEvents: 'auto' }}
        data-testid="object-count"
      >
        {fmtCount(count)} {count === 1 ? 'object' : 'objects'}
      </Text>
    </Group>
  );
}
