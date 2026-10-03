import { Alert, Button, Group, List, Stack, Table, Text } from '@mantine/core';
import { useState } from 'react';

import { fmt } from '../../engine/math';
import { analyzeModel, type AnalyzeResult } from '../../services/geometryApi';
import { useProjectStore } from '../../state/projectStore';
import { formatAmount } from '../inspector/MeasureTab';
import { ServiceBadge, SERVICE_HELP, useServiceOnline } from './ServiceStatus';

/** Exact measurements of everything in the scene, with overlaps removed (needs the Python service). */
export function WholeModelMeasure() {
  const online = useServiceOnline();
  const units = useProjectStore((s) => s.project.units);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const { serviceGlb } = await import('../../export/serviceModel');
      setResult(await analyzeModel(await serviceGlb(useProjectStore.getState().project)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack gap={6}>
      <Group justify="space-between">
        <Text size="sm" fw={600}>
          The whole model, exactly
        </Text>
        <ServiceBadge />
      </Group>
      <Text size="xs" c="dimmed">
        Joins every shape together (like a real 3D print), so overlapping parts are only counted once.
      </Text>
      <Button
        size="xs"
        variant="light"
        onClick={run}
        loading={busy}
        disabled={!online}
        title={online ? undefined : SERVICE_HELP}
        data-testid="measure-all"
      >
        Measure everything
      </Button>
      {error && (
        <Alert color="red" p="xs">
          {error}
        </Alert>
      )}
      {result && (
        <>
          <Table fz="xs" withRowBorders={false} verticalSpacing={2} data-testid="measure-result">
            <Table.Tbody>
              <Table.Tr>
                <Table.Td>Volume</Table.Td>
                <Table.Td>{result.volume === null ? '—' : formatAmount(result.volume, 3, units)}</Table.Td>
              </Table.Tr>
              {result.overlap_volume !== null && result.overlap_volume > 1e-6 && (
                <Table.Tr>
                  <Table.Td>Overlap removed</Table.Td>
                  <Table.Td>{formatAmount(result.overlap_volume, 3, units)}</Table.Td>
                </Table.Tr>
              )}
              <Table.Tr>
                <Table.Td>Surface area</Table.Td>
                <Table.Td>{formatAmount(result.surface_area, 2, units)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Size (w × h × d)</Table.Td>
                <Table.Td>
                  {result.bounds.size.map((v) => fmt(v)).join(' × ')} {units}
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Closed solid?</Table.Td>
                <Table.Td>
                  {result.is_watertight ? 'Yes, ready to 3D print' : 'No (has open sheets)'}
                </Table.Td>
              </Table.Tr>
              {result.bodies !== null && (
                <Table.Tr>
                  <Table.Td>Separate pieces</Table.Td>
                  <Table.Td>{result.bodies}</Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
          {result.notes.length > 0 && (
            <List size="xs">
              {result.notes.map((n) => (
                <List.Item key={n}>{n}</List.Item>
              ))}
            </List>
          )}
        </>
      )}
    </Stack>
  );
}
