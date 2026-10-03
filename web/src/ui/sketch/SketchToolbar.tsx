import { ActionIcon, Button, Divider, NumberInput, Popover, Stack, Text, Tooltip } from '@mantine/core';
import {
  IconCircle,
  IconCopy,
  IconFlipVertical,
  IconFocusCentered,
  IconHandMove,
  IconLetterH,
  IconLetterV,
  IconLine,
  IconMagnet,
  IconPin,
  IconPoint,
  IconPointer,
  IconRotateClockwise,
  IconRuler2,
  IconRulerMeasure,
  IconTrash,
} from '@tabler/icons-react';
import { type ReactNode, useEffect, useState } from 'react';

import { pointMap } from '../../engine/sketch/geometry';
import type { SketchConstraintType } from '../../engine/types';
import { useProjectStore } from '../../state/projectStore';
import { notifications } from '../notify';
import {
  addConstraint,
  copySelection,
  deleteItems,
  getSketch,
  mirrorSelection,
  rotateSelection,
  setPointFixed,
} from './sketchActions';
import { type SketchTool, useSketchUi } from './sketchStore';

const TOOLS: { tool: SketchTool; label: string; key: string; icon: ReactNode }[] = [
  { tool: 'select', label: 'Select and move', key: 'V', icon: <IconPointer size={18} /> },
  { tool: 'point', label: 'Point', key: 'O', icon: <IconPoint size={18} /> },
  { tool: 'line', label: 'Line', key: 'L', icon: <IconLine size={18} /> },
  { tool: 'circle', label: 'Circle by radius', key: 'C', icon: <IconCircle size={18} /> },
  { tool: 'pan', label: 'Move the view', key: 'H', icon: <IconHandMove size={18} /> },
];

function Tool({
  label,
  icon,
  onClick,
  active,
  disabled,
  testId,
}: {
  label: string;
  icon: ReactNode;
  onClick(): void;
  active?: boolean;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <Tooltip label={label} position="right" withArrow>
      <ActionIcon
        size={36}
        radius="md"
        variant={active ? 'filled' : 'subtle'}
        color={active ? 'violet' : 'gray'}
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={active}
        data-testid={testId}
      >
        {icon}
      </ActionIcon>
    </Tooltip>
  );
}

/** Which kinds of things are selected, for enabling the buttons. */
function useSelectionKinds() {
  const selection = useSketchUi((s) => s.selection);
  const sketch = useProjectStore((s) => s.project.sketch);
  const lines = sketch?.lines.filter((l) => selection.includes(l.id)).map((l) => l.id) ?? [];
  const circles = sketch?.circles.filter((c) => selection.includes(c.id)).map((c) => c.id) ?? [];
  const points = sketch?.points.filter((p) => selection.includes(p.id)).map((p) => p.id) ?? [];
  return { selection, lines, circles, points };
}

function constrain(type: SketchConstraintType, refs: string[]) {
  addConstraint(type, refs);
  const { unmet } = useSketchUi.getState();
  const rule = getSketch().constraints.at(-1);
  if (rule && unmet.includes(rule.id)) {
    notifications.show({
      color: 'orange',
      message: 'That rule fights another one (shown in red). Remove one of them.',
    });
  }
}

/** A small number box that pops out of a button (rotate by an angle). */
function RotateButton({ disabled, ids }: { disabled: boolean; ids: string[] }) {
  const [open, setOpen] = useState(false);
  const [angle, setAngle] = useState<number | string>(90);
  return (
    <Popover opened={open} onChange={setOpen} position="right" withArrow trapFocus>
      <Popover.Target>
        <div>
          <Tool
            label="Rotate"
            icon={<IconRotateClockwise size={18} />}
            onClick={() => setOpen((o) => !o)}
            disabled={disabled}
          />
        </div>
      </Popover.Target>
      <Popover.Dropdown>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            rotateSelection(ids, Number(angle) || 0);
            setOpen(false);
          }}
        >
          <Stack gap={6}>
            <NumberInput
              size="xs"
              w={140}
              label="Turn by (degrees)"
              value={angle}
              onChange={setAngle}
              data-autofocus
            />
            <Text size="xs" c="dimmed">
              Anticlockwise; negative turns the other way.
            </Text>
            <Button size="xs" type="submit">
              Rotate
            </Button>
          </Stack>
        </form>
      </Popover.Dropdown>
    </Popover>
  );
}

export function SketchToolbar() {
  const ui = useSketchUi();
  const { selection, lines, circles, points } = useSelectionKinds();
  const anything = selection.length > 0;

  // keys for the 2D board (the 3D shortcuts are off while it is open)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const s = useSketchUi.getState();
      const key = e.key.toLowerCase();
      const tool = TOOLS.find((x) => x.key.toLowerCase() === key);
      if (tool) {
        s.set({ tool: tool.tool, chainFrom: null, chainStart: null, circleCentre: null });
      } else if (key === 'escape') {
        if (s.chainFrom || s.circleCentre) s.set({ chainFrom: null, chainStart: null, circleCentre: null });
        else s.set({ selection: [], shape: null });
      } else if (key === 'delete' || key === 'backspace') {
        deleteItems(s.selection);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const fitView = () => {
    const sk = getSketch();
    if (!sk.points.length) return ui.set({ view: { cx: 0, cy: 0, scale: 40 } });
    const byId = pointMap(sk);
    const xs: number[] = [];
    const ys: number[] = [];
    for (const p of sk.points) {
      xs.push(p.x);
      ys.push(p.y);
    }
    for (const c of sk.circles) {
      const p = byId.get(c.c);
      if (!p) continue;
      xs.push(p.x - c.r, p.x + c.r);
      ys.push(p.y - c.r, p.y + c.r);
    }
    const w = Math.max(...xs) - Math.min(...xs) || 4;
    const h = Math.max(...ys) - Math.min(...ys) || 4;
    const el = document.querySelector('[data-testid="sketch-canvas"]');
    const box = el?.getBoundingClientRect() ?? { width: 800, height: 600 };
    ui.set({
      view: {
        cx: (Math.max(...xs) + Math.min(...xs)) / 2,
        cy: (Math.max(...ys) + Math.min(...ys)) / 2,
        scale: Math.min(400, Math.max(4, 0.75 * Math.min(box.width / w, box.height / h))),
      },
    });
  };

  return (
    <Stack gap={4} p={6} className="sk-rail mm-float" data-testid="sketch-toolbar">
      {TOOLS.map((t) => (
        <Tool
          key={t.tool}
          label={`${t.label} (${t.key})`}
          icon={t.icon}
          active={ui.tool === t.tool}
          onClick={() => ui.set({ tool: t.tool, chainFrom: null, chainStart: null, circleCentre: null })}
          testId={`sketch-tool-${t.tool}`}
        />
      ))}
      <Divider my={2} />
      <Tool
        label="Make horizontal"
        icon={<IconLetterH size={18} />}
        disabled={!lines.length}
        onClick={() => lines.forEach((l) => constrain('horizontal', [l]))}
        testId="sketch-horizontal"
      />
      <Tool
        label="Make vertical"
        icon={<IconLetterV size={18} />}
        disabled={!lines.length}
        onClick={() => lines.forEach((l) => constrain('vertical', [l]))}
      />
      <Tool
        label="Make parallel (pick 2 lines)"
        icon={<Text fw={800}>∥</Text>}
        disabled={lines.length !== 2}
        onClick={() => constrain('parallel', lines)}
      />
      <Tool
        label="Make perpendicular (pick 2 lines)"
        icon={<Text fw={800}>⊥</Text>}
        disabled={lines.length !== 2}
        onClick={() => constrain('perpendicular', lines)}
      />
      <Tool
        label="Fix the length"
        icon={<IconRuler2 size={18} />}
        disabled={!lines.length}
        onClick={() => lines.forEach((l) => constrain('length', [l]))}
        testId="sketch-fix-length"
      />
      <Tool
        label="Fix the radius"
        icon={<Text fw={800}>r</Text>}
        disabled={!circles.length}
        onClick={() => circles.forEach((c) => constrain('radius', [c]))}
      />
      <Tool
        label="Pin points in place"
        icon={<IconPin size={18} />}
        disabled={!points.length}
        onClick={() => {
          const sk = getSketch();
          const allFixed = points.every((id) => sk.points.find((p) => p.id === id)?.fixed);
          setPointFixed(points, !allFixed);
        }}
      />
      <Divider my={2} />
      <Tool
        label="Mirror (about a selected line, or the up-down axis)"
        icon={<IconFlipVertical size={18} />}
        disabled={!anything}
        onClick={() => {
          const how = mirrorSelection(selection);
          notifications.show({
            message: how === 'line' ? 'Mirrored in the selected line.' : 'Mirrored in the up-and-down axis.',
          });
        }}
        testId="sketch-mirror"
      />
      <RotateButton disabled={!anything} ids={selection} />
      <Tool
        label="Copy"
        icon={<IconCopy size={18} />}
        disabled={!anything}
        onClick={() => copySelection(selection)}
      />
      <Tool
        label="Delete (Del)"
        icon={<IconTrash size={18} />}
        disabled={!anything}
        onClick={() => deleteItems(selection)}
        testId="sketch-delete"
      />
      <Divider my={2} />
      <Tool
        label={ui.snapOn ? 'Snapping: on' : 'Snapping: off'}
        icon={<IconMagnet size={18} />}
        active={ui.snapOn}
        onClick={() => ui.set({ snapOn: !ui.snapOn })}
      />
      <Tool
        label={ui.showMeasures ? 'Hide measurements' : 'Show measurements'}
        icon={<IconRulerMeasure size={18} />}
        active={ui.showMeasures}
        onClick={() => ui.set({ showMeasures: !ui.showMeasures })}
      />
      <Tool label="Fit the drawing in view" icon={<IconFocusCentered size={18} />} onClick={fitView} />
    </Stack>
  );
}
