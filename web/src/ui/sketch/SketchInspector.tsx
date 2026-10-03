import {
  ActionIcon,
  Badge,
  Button,
  Group,
  NumberInput,
  ScrollArea,
  Stack,
  Switch,
  Text,
  Tooltip,
} from '@mantine/core';
import { IconCube, IconLayoutSidebarRightCollapse, IconRotate360, IconX } from '@tabler/icons-react';
import { useState } from 'react';

import { fmt } from '../../engine/math';
import {
  emptySketch,
  findLoops,
  lineAngle,
  lineEnds,
  lineLength,
  loopCoords,
  pointMap,
} from '../../engine/sketch/geometry';
import {
  angleFormulas,
  circleFormulas,
  lineFormulas,
  loopFormulas,
  pointFormulas,
  type SketchFormula,
  withUnit,
} from '../../engine/sketch/measure';
import type { Sketch } from '../../engine/types';
import { useProjectStore } from '../../state/projectStore';
import {
  pushUpShape,
  removeConstraint,
  setLineAngle,
  setLineLength,
  setPointFixed,
  setPointXY,
  setRadius,
  spinLines,
} from './sketchActions';
import { useSketchUi } from './sketchStore';

function Formulas({ items, units }: { items: SketchFormula[]; units: string }) {
  return (
    <Stack gap={8}>
      {items.map((f) => (
        <div key={f.quantity} className="sk-formula">
          <Group justify="space-between" wrap="nowrap" gap="xs">
            <Text size="sm" fw={600}>
              {f.quantity}
            </Text>
            {Number.isFinite(f.value) && (
              <Text
                size="sm"
                fw={700}
                c="violet"
                data-testid={`measure-${f.quantity.toLowerCase().replace(/\W+/g, '-')}`}
              >
                {withUnit(f, units)}
              </Text>
            )}
          </Group>
          <Text size="xs" ff="monospace">
            {f.formula}
          </Text>
          <Text size="xs" c="dimmed">
            {f.working}
          </Text>
        </div>
      ))}
    </Stack>
  );
}

function Num({
  label,
  value,
  onCommit,
  min,
  testId,
}: {
  label: string;
  value: number;
  onCommit(v: number): void;
  min?: number;
  testId?: string;
}) {
  return (
    <NumberInput
      size="xs"
      label={label}
      value={Number(value.toFixed(3))}
      min={min}
      decimalScale={3}
      step={0.5}
      onChange={(v) => {
        const n = typeof v === 'number' ? v : parseFloat(v);
        if (Number.isFinite(n) && (min === undefined || n >= min)) onCommit(n);
      }}
      data-testid={testId}
    />
  );
}

function MakeThreeD({ onPush, onSpin }: { onPush?(h: number): void; onSpin?(): void }) {
  const [height, setHeight] = useState<number | string>(1);
  return (
    <Stack gap={6} className="sk-make3d">
      <Text className="mm-label">Into 3D</Text>
      {onPush && (
        <Group gap={6} wrap="nowrap" align="flex-end">
          <NumberInput
            size="xs"
            label="Height"
            value={height}
            onChange={setHeight}
            min={0.05}
            decimalScale={2}
            w={100}
          />
          <Button
            size="xs"
            leftSection={<IconCube size={14} />}
            onClick={() => onPush(Number(height) > 0 ? Number(height) : 1)}
            data-testid="sketch-push-up"
          >
            Push up into 3D
          </Button>
        </Group>
      )}
      {onSpin && (
        <Button size="xs" variant="light" leftSection={<IconRotate360 size={14} />} onClick={onSpin}>
          Spin around the up-down axis
        </Button>
      )}
    </Stack>
  );
}

function RuleList({ sketch }: { sketch: Sketch }) {
  const unmet = useSketchUi((s) => s.unmet);
  if (!sketch.constraints.length) return null;
  const name = (id: string) => {
    const li = sketch.lines.findIndex((l) => l.id === id);
    if (li >= 0) return `line ${li + 1}`;
    const ci = sketch.circles.findIndex((c) => c.id === id);
    if (ci >= 0) return `circle ${ci + 1}`;
    return 'a point';
  };
  return (
    <Stack gap={4}>
      <Text className="mm-label">Rules</Text>
      {sketch.constraints.map((c) => (
        <Group key={c.id} justify="space-between" wrap="nowrap" gap={4}>
          <Text size="xs" c={unmet.includes(c.id) ? 'red' : undefined}>
            {c.type[0].toUpperCase() + c.type.slice(1)}: {c.refs.map(name).join(' and ')}
            {c.value !== undefined ? ` = ${fmt(c.value)}` : ''}
            {unmet.includes(c.id) ? ' (not met)' : ''}
          </Text>
          <ActionIcon size="sm" onClick={() => removeConstraint(c.id)} aria-label="Remove rule">
            <IconX size={12} />
          </ActionIcon>
        </Group>
      ))}
    </Stack>
  );
}

export function SketchInspector({ onHide }: { onHide(): void }) {
  const sketch = useProjectStore((s) => s.project.sketch) ?? emptySketch();
  const units = useProjectStore((s) => s.project.units);
  const { selection, shape } = useSketchUi();
  const byId = pointMap(sketch);
  const points = sketch.points.filter((p) => selection.includes(p.id));
  const lines = sketch.lines.filter((l) => selection.includes(l.id));
  const circles = sketch.circles.filter((c) => selection.includes(c.id));

  let body: React.ReactNode;
  if (shape?.kind === 'loop') {
    const loop = findLoops(sketch).find(
      (l) => l.lines.length === shape.lines.length && l.lines.every((id) => shape.lines.includes(id)),
    );
    body = loop ? (
      <>
        <Text fw={700}>Closed shape · {loop.points.length} corners</Text>
        <Formulas items={loopFormulas(loopCoords(sketch, loop))} units={units} />
        <MakeThreeD onPush={(h) => pushUpShape(shape, h)} onSpin={() => spinLines(loop.lines, true)} />
      </>
    ) : null;
  } else if (selection.length === 1 && points.length === 1) {
    const p = points[0];
    body = (
      <>
        <Text fw={700}>Point</Text>
        <Group grow>
          <Num label={`x (${units})`} value={p.x} onCommit={(x) => setPointXY(p.id, x, p.y)} />
          <Num label={`y (${units})`} value={p.y} onCommit={(y) => setPointXY(p.id, p.x, y)} />
        </Group>
        <Switch
          size="sm"
          label="Pinned (never moves)"
          checked={p.fixed}
          onChange={(e) => setPointFixed([p.id], e.currentTarget.checked)}
        />
        <Formulas items={pointFormulas(p)} units={units} />
      </>
    );
  } else if (selection.length === 1 && lines.length === 1) {
    const l = lines[0];
    const ends = lineEnds(sketch, l);
    body = ends ? (
      <>
        <Text fw={700}>Line</Text>
        <Group grow>
          <Num
            label={`Length (${units})`}
            value={lineLength(...ends)}
            min={0.001}
            onCommit={(v) => setLineLength(l.id, v)}
            testId="sketch-line-length"
          />
          <Num label="Angle (°)" value={lineAngle(...ends)} onCommit={(v) => setLineAngle(l.id, v)} />
        </Group>
        <Formulas items={lineFormulas(sketch, l)} units={units} />
        <MakeThreeD onSpin={() => spinLines([l.id], false)} />
      </>
    ) : null;
  } else if (selection.length === 1 && circles.length === 1) {
    const c = circles[0];
    const centre = byId.get(c.c);
    body = (
      <>
        <Text fw={700}>Circle</Text>
        <Group grow>
          <Num
            label={`Radius (${units})`}
            value={c.r}
            min={0.001}
            onCommit={(r) => setRadius(c.id, r)}
            testId="sketch-circle-radius"
          />
          {centre && (
            <Num label="Centre x" value={centre.x} onCommit={(x) => setPointXY(centre.id, x, centre.y)} />
          )}
          {centre && (
            <Num label="Centre y" value={centre.y} onCommit={(y) => setPointXY(centre.id, centre.x, y)} />
          )}
        </Group>
        <Formulas items={circleFormulas(c)} units={units} />
        <MakeThreeD onPush={(h) => pushUpShape({ kind: 'circle', id: c.id }, h)} />
      </>
    );
  } else if (lines.length === 2 && selection.length === 2) {
    body = (
      <>
        <Text fw={700}>Two lines</Text>
        <Formulas items={angleFormulas(sketch, lines[0], lines[1])} units={units} />
        <Text size="xs" c="dimmed">
          Use ∥ or ⊥ on the left to make them parallel or perpendicular.
        </Text>
      </>
    );
  } else if (selection.length > 0) {
    body = (
      <>
        <Text fw={700}>{selection.length} things selected</Text>
        {lines.length > 0 && (
          <MakeThreeD
            onSpin={() =>
              spinLines(
                lines.map((l) => l.id),
                false,
              )
            }
          />
        )}
        <Text size="xs" c="dimmed">
          Mirror, rotate, copy or delete them with the tools on the left.
        </Text>
      </>
    );
  } else {
    body = (
      <>
        <Group gap={6}>
          <Badge variant="light">{sketch.points.length} points</Badge>
          <Badge variant="light">{sketch.lines.length} lines</Badge>
          <Badge variant="light">{sketch.circles.length} circles</Badge>
          <Badge variant="light">{findLoops(sketch).length} closed shapes</Badge>
        </Group>
        <Text size="xs" c="dimmed">
          Draw with Line (L) and Circle (C). Click a line, a point or a circle to see its maths; click inside
          a closed shape for its area. Snapping joins lines to points, midpoints and the grid.
        </Text>
      </>
    );
  }

  return (
    <Stack gap={0} h="100%">
      <Group justify="space-between" wrap="nowrap" px="sm" pt={10} pb={2}>
        <Text className="mm-label">2D sketch</Text>
        <Tooltip label="Hide details panel" position="left">
          <ActionIcon size="lg" onClick={onHide} aria-label="Hide details panel">
            <IconLayoutSidebarRightCollapse size={19} />
          </ActionIcon>
        </Tooltip>
      </Group>
      <ScrollArea flex={1} type="auto" offsetScrollbars>
        <Stack p="sm" pt={4} gap="md" data-testid="sketch-inspector">
          {body}
          <RuleList sketch={sketch} />
        </Stack>
      </ScrollArea>
    </Stack>
  );
}
