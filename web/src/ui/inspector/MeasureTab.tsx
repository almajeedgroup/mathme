import { Alert, Code, Divider, Paper, Stack, Text } from '@mantine/core';
import { useMemo } from 'react';

import { layoutPattern } from '../../engine/layout';
import { fmt } from '../../engine/math';
import { measureShape, type ShapeMeasurement } from '../../engine/measureShape';
import { symmetryCopyCount } from '../../engine/three/transforms';
import type { ObjectNode, PatternNode, Project, SourceRef, Units } from '../../engine/types';
import { useProjectStore } from '../../state/projectStore';
import { useUnits } from './common';
import { WholeModelMeasure } from '../service/WholeModelMeasure';

const sup = (p: 1 | 2 | 3) => (p === 3 ? '³' : p === 2 ? '²' : '');

export function formatAmount(value: number, power: 1 | 2 | 3, units: Units): string {
  const n = Math.abs(value) >= 1000 ? Math.round(value).toLocaleString('en-US') : fmt(value);
  return `${n} ${units}${sup(power)}`;
}

function measureSource(source: SourceRef, project: Project): ShapeMeasurement | null {
  const ctx = { meshes: project.meshes };
  if (source.kind === 'shape') return measureShape(source.shape, ctx);
  const custom = project.library.find((c) => c.id === source.customId);
  if (!custom) return null;
  let volume = 0;
  let area = 0;
  let triangles = 0;
  let open = false;
  for (const part of custom.parts) {
    const m = measureShape(part.shape, ctx);
    const [sx, sy, sz] = part.transform.scale;
    volume += (m.volume ?? 0) * Math.abs(sx * sy * sz);
    area += m.area * Math.cbrt(Math.abs(sx * sy * sz)) ** 2;
    triangles += m.triangles;
    open ||= m.open;
  }
  return { method: 'mesh', lines: [], volume: open ? null : volume, area, triangles, open };
}

export function MeasureTab({ node }: { node: ObjectNode | PatternNode }) {
  const project = useProjectStore((s) => s.project);
  const units = useUnits();
  const m = useMemo(() => measureSource(node.source, project), [node.source, project]);
  const layout = useMemo(() => (node.kind === 'pattern' ? layoutPattern(node) : null), [node]);
  if (!m) return <Text size="sm">Nothing to measure.</Text>;

  const [sx, sy, sz] = node.transform.scale;
  const stretch = Math.abs(sx * sy * sz);
  const copies = symmetryCopyCount(node.symmetry);

  return (
    <Stack gap="sm">
      <Text size="sm" fw={600}>
        One {node.kind === 'pattern' ? 'object (normal size)' : 'object'}
      </Text>
      {m.lines.map((l) => (
        <Paper key={l.quantity} withBorder p="xs" radius="md">
          <Text size="xs" c="dimmed">
            {l.quantity}
          </Text>
          <Code block fz="xs">
            {l.formula}
            {'\n'}
            {l.working}
            {'\n'}= {formatAmount(l.value, l.power, units)}
          </Code>
        </Paper>
      ))}
      {m.method === 'mesh' && (
        <Paper withBorder p="xs" radius="md">
          <Text size="xs">
            This shape has no simple school formula, so we measured it by adding up its{' '}
            {m.triangles.toLocaleString()} little triangles.
          </Text>
          {m.volume !== null && <Text size="sm">Volume ≈ {formatAmount(m.volume, 3, units)}</Text>}
          <Text size="sm">Surface area ≈ {formatAmount(m.area, 2, units)}</Text>
        </Paper>
      )}
      {m.open && (
        <Alert color="gray" p="xs">
          This is a thin sheet with no inside, so it has an area but no volume.
        </Alert>
      )}
      {node.kind === 'object' && stretch !== 1 && m.volume !== null && (
        <Text size="xs">
          It is stretched by {fmt(sx)} × {fmt(sy)} × {fmt(sz)}, so its real volume is {fmt(m.volume)} ×{' '}
          {fmt(stretch)} = {formatAmount(m.volume * stretch, 3, units)}.
        </Text>
      )}
      {layout && (
        <>
          <Divider />
          <PatternTotals m={m} sizes={layout.sizes} copies={copies} stretch={stretch} units={units} />
        </>
      )}
      <Divider />
      <WholeModelMeasure />
    </Stack>
  );
}

function PatternTotals({
  m,
  sizes,
  copies,
  stretch,
  units,
}: {
  m: ShapeMeasurement;
  sizes: Float32Array;
  copies: number;
  stretch: number;
  units: Units;
}) {
  let cubes = 0;
  let squares = 0;
  for (const s of sizes) {
    cubes += s ** 3;
    squares += s ** 2;
  }
  const n = sizes.length * copies;
  return (
    <Stack gap={4}>
      <Text size="sm" fw={600}>
        All {n.toLocaleString()} objects
      </Text>
      <Text size="xs" c="dimmed">
        When an object is k times bigger, its area is k² times bigger and its volume is k³ times bigger. So we
        add up size³ for every object (Σ size³ = {fmt(cubes)}).
      </Text>
      {m.volume !== null && (
        <Text size="sm">
          Total volume = {fmt(m.volume)} × {fmt(cubes)}
          {copies > 1 ? ` × ${copies} copies` : ''}
          {stretch !== 1 ? ` × ${fmt(stretch)} stretch` : ''} ={' '}
          {formatAmount(m.volume * cubes * copies * stretch, 3, units)}
        </Text>
      )}
      <Text size="sm">
        Total surface area = {fmt(m.area)} × {fmt(squares)}
        {copies > 1 ? ` × ${copies}` : ''} ≈{' '}
        {formatAmount(m.area * squares * copies * Math.cbrt(stretch) ** 2, 2, units)}
      </Text>
      <Text size="xs" c="dimmed">
        If objects overlap, the overlapping parts are counted twice.
      </Text>
    </Stack>
  );
}
