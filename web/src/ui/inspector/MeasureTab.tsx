import { Alert, Code, Divider, Paper, Stack, Text } from '@mantine/core';
import { useMemo } from 'react';

import { fmt } from '../../engine/math';
import { measureNode, type NodeTotals } from '../../engine/measureNode';
import type { ObjectNode, PatternNode, Units } from '../../engine/types';
import { useProjectStore } from '../../state/projectStore';
import { useUnits } from './common';
import { WholeModelMeasure } from '../service/WholeModelMeasure';

const sup = (p: 1 | 2 | 3) => (p === 3 ? '³' : p === 2 ? '²' : '');

export function formatAmount(value: number, power: 1 | 2 | 3, units: Units): string {
  const n = Math.abs(value) >= 1000 ? Math.round(value).toLocaleString('en-US') : fmt(value);
  return `${n} ${units}${sup(power)}`;
}

export function MeasureTab({ node }: { node: ObjectNode | PatternNode }) {
  const project = useProjectStore((s) => s.project);
  const units = useUnits();
  const totals = useMemo(() => measureNode(node, project), [node, project]);
  if (!totals) return <Text size="sm">Nothing to measure.</Text>;
  const m = totals.one;
  const [sx, sy, sz] = node.transform.scale;
  const stretch = totals.stretch;

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
      {node.kind === 'pattern' && (
        <>
          <Divider />
          <PatternTotals totals={totals} units={units} />
        </>
      )}
      <Divider />
      <WholeModelMeasure />
    </Stack>
  );
}

function PatternTotals({ totals, units }: { totals: NodeTotals; units: Units }) {
  const { one: m, sumCubes, sumSquares, copies, stretch, count } = totals;
  return (
    <Stack gap={4}>
      <Text size="sm" fw={600}>
        All {count.toLocaleString()} objects
      </Text>
      <Text size="xs" c="dimmed">
        When an object is k times bigger, its area is k² times bigger and its volume is k³ times bigger. So we
        add up size³ for every object (Σ size³ = {fmt(sumCubes)}).
      </Text>
      {totals.totalVolume !== null && m.volume !== null && (
        <Text size="sm">
          Total volume = {fmt(m.volume)} × {fmt(sumCubes)}
          {copies > 1 ? ` × ${copies} copies` : ''}
          {stretch !== 1 ? ` × ${fmt(stretch)} stretch` : ''} = {formatAmount(totals.totalVolume, 3, units)}
        </Text>
      )}
      <Text size="sm">
        Total surface area = {fmt(m.area)} × {fmt(sumSquares)}
        {copies > 1 ? ` × ${copies}` : ''} ≈ {formatAmount(totals.totalArea, 2, units)}
      </Text>
      <Text size="xs" c="dimmed">
        If objects overlap, the overlapping parts are counted twice.
      </Text>
    </Stack>
  );
}
