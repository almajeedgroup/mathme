import { ActionIcon, Button, Group, Menu, NumberInput, Stack, Text, Tooltip } from '@mantine/core';
import { IconChevronDown, IconTrash } from '@tabler/icons-react';
import { useMemo, useRef, useState } from 'react';

import { fmt } from '../../engine/math';
import type { ProfilePreset } from '../../engine/shapes/profiles';
import type { Vec2 } from '../../engine/types';

interface ViewBox {
  x0: number;
  y0: number;
  size: number;
}

const SIZE = 260;
const SNAP = 0.1;

function computeView(points: Vec2[], mode: 'profile' | 'outline'): ViewBox {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = mode === 'profile' ? -0.5 : Math.min(-1, ...xs) - 1;
  const maxX = Math.max(1, ...xs) + 1;
  const minY = Math.min(0, ...ys) - 1;
  const maxY = Math.max(1, ...ys) + 1;
  const size = Math.max(maxX - minX, maxY - minY, 4);
  return { x0: minX, y0: maxY - size + (size - (maxY - minY)) / 2, size };
}

/** Distance from point p to the segment a-b. */
function segDist(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/**
 * A small drawing board for 2D outlines. Drag points to move them, click empty space to add
 * a point, and use the bin to remove the selected point.
 */
export function ProfileEditor({
  label,
  mode,
  points,
  presets,
  onChange,
}: {
  label: string;
  mode: 'profile' | 'outline';
  points: Vec2[];
  presets: ProfilePreset[];
  onChange(points: Vec2[]): void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [frozen, setFrozen] = useState<ViewBox | null>(null);
  const liveView = useMemo(() => computeView(points, mode), [points, mode]);
  const view = frozen ?? liveView;
  const scale = SIZE / view.size;

  const toScreen = ([x, y]: Vec2): [number, number] => [
    (x - view.x0) * scale,
    (view.y0 + view.size - y) * scale,
  ];
  const toWorld = (clientX: number, clientY: number): Vec2 => {
    const rect = svgRef.current!.getBoundingClientRect();
    const sx = ((clientX - rect.left) / rect.width) * SIZE;
    const sy = ((clientY - rect.top) / rect.height) * SIZE;
    const snap = (v: number) => Math.round(v / SNAP) * SNAP;
    let x = snap(view.x0 + sx / scale);
    const y = snap(view.y0 + view.size - sy / scale);
    if (mode === 'profile') x = Math.max(0, x);
    return [Number(x.toFixed(2)), Number(y.toFixed(2))];
  };

  const addPoint = (p: Vec2) => {
    if (points.length < 2) {
      onChange([...points, p]);
      setSelected(points.length);
      return;
    }
    let best = 0;
    let bestD = Infinity;
    const segments = mode === 'outline' ? points.length : points.length - 1;
    for (let i = 0; i < segments; i++) {
      const d = segDist(p, points[i], points[(i + 1) % points.length]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const next = [...points];
    next.splice(best + 1, 0, p);
    onChange(next);
    setSelected(best + 1);
  };

  const removeSelected = () => {
    if (selected === null || points.length <= (mode === 'outline' ? 3 : 2)) return;
    onChange(points.filter((_, i) => i !== selected));
    setSelected(null);
  };

  const gridLines = [];
  const step = view.size > 12 ? 2 : 1;
  for (let v = Math.ceil(view.x0 / step) * step; v <= view.x0 + view.size; v += step) {
    const [sx] = toScreen([v, 0]);
    gridLines.push(
      <line
        key={`x${v}`}
        x1={sx}
        x2={sx}
        y1={0}
        y2={SIZE}
        stroke="currentColor"
        strokeOpacity={v === 0 ? 0.35 : 0.1}
      />,
    );
  }
  for (let v = Math.ceil(view.y0 / step) * step; v <= view.y0 + view.size; v += step) {
    const [, sy] = toScreen([0, v]);
    gridLines.push(
      <line
        key={`y${v}`}
        x1={0}
        x2={SIZE}
        y1={sy}
        y2={sy}
        stroke="currentColor"
        strokeOpacity={v === 0 ? 0.35 : 0.1}
      />,
    );
  }
  const screenPts = points.map(toScreen);
  const path = screenPts.map((p) => p.join(',')).join(' ');
  const sel = selected !== null ? points[selected] : null;

  return (
    <Stack gap={6}>
      <Group justify="space-between">
        <Text size="sm" fw={500}>
          {label}
        </Text>
        <Menu shadow="md" position="bottom-end">
          <Menu.Target>
            <Button size="compact-xs" variant="light" rightSection={<IconChevronDown size={12} />}>
              Ready-made
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            {presets.map((p) => (
              <Menu.Item key={p.id} onClick={() => onChange(structuredClone(p.points))}>
                {p.label}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      </Group>
      <svg
        ref={svgRef}
        role="application"
        aria-label={`${label} drawing board`}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{
          width: '100%',
          aspectRatio: '1',
          touchAction: 'none',
          background: 'var(--mantine-color-default)',
          border: '1px solid var(--mantine-color-default-border)',
          borderRadius: 8,
          cursor: dragIndex !== null ? 'grabbing' : 'crosshair',
        }}
        onPointerMove={(e) => {
          if (dragIndex === null) return;
          const next = [...points];
          next[dragIndex] = toWorld(e.clientX, e.clientY);
          onChange(next);
        }}
        onPointerUp={() => {
          setDragIndex(null);
          setFrozen(null);
        }}
        onPointerDown={(e) => {
          if (e.target === svgRef.current || (e.target as Element).tagName === 'line') {
            addPoint(toWorld(e.clientX, e.clientY));
          }
        }}
      >
        {gridLines}
        {mode === 'profile' && (
          <>
            <line
              x1={toScreen([0, 0])[0]}
              x2={toScreen([0, 0])[0]}
              y1={0}
              y2={SIZE}
              stroke="#fa5252"
              strokeDasharray="6 4"
              strokeWidth={1.5}
            />
            <text x={toScreen([0, 0])[0] + 4} y={14} fontSize={10} fill="#fa5252">
              spin axis
            </text>
          </>
        )}
        {mode === 'outline' ? (
          <polygon
            points={path}
            fill="#748ffc"
            fillOpacity={0.25}
            stroke="#4c6ef5"
            strokeWidth={2}
            pointerEvents="none"
          />
        ) : (
          <polyline points={path} fill="none" stroke="#4c6ef5" strokeWidth={2} pointerEvents="none" />
        )}
        {screenPts.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={selected === i ? 7 : 5.5}
            fill={selected === i ? '#f76707' : '#4c6ef5'}
            stroke="white"
            strokeWidth={1.5}
            style={{ cursor: 'grab' }}
            onPointerDown={(e) => {
              e.stopPropagation();
              (e.target as Element).setPointerCapture?.(e.pointerId);
              setFrozen(view);
              setDragIndex(i);
              setSelected(i);
            }}
          />
        ))}
      </svg>
      <Group gap="xs" wrap="nowrap" align="flex-end">
        {sel ? (
          <>
            <NumberInput
              size="xs"
              label={mode === 'profile' ? 'Out from axis' : 'x'}
              value={sel[0]}
              step={0.1}
              min={mode === 'profile' ? 0 : undefined}
              onChange={(v) => {
                if (typeof v !== 'number' || selected === null) return;
                const next = [...points];
                next[selected] = [mode === 'profile' ? Math.max(0, v) : v, sel[1]];
                onChange(next);
              }}
            />
            <NumberInput
              size="xs"
              label={mode === 'profile' ? 'Height' : 'y'}
              value={sel[1]}
              step={0.1}
              onChange={(v) => {
                if (typeof v !== 'number' || selected === null) return;
                const next = [...points];
                next[selected] = [sel[0], v];
                onChange(next);
              }}
            />
            <Tooltip label="Remove this point">
              <ActionIcon
                variant="light"
                color="red"
                onClick={removeSelected}
                aria-label="Remove point"
                mb={2}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </>
        ) : (
          <Text size="xs" c="dimmed">
            Drag the dots to change the shape. Click empty space to add a dot. {points.length} points
            {points.length ? `, point 1 at (${fmt(points[0][0])}, ${fmt(points[0][1])})` : ''}.
          </Text>
        )}
      </Group>
    </Stack>
  );
}
