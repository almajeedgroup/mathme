import { Button, Group, SegmentedControl, Stack, Text } from '@mantine/core';
import { useState } from 'react';

import { downloadBlob, slugify } from '../../export/download';
import { printReadyExport, type PrintFormat } from '../../services/geometryApi';
import { useProjectStore } from '../../state/projectStore';
import { notifications } from '../notify';
import { ServiceBadge, SERVICE_HELP, useServiceOnline } from './ServiceStatus';

/** Joined, repaired file for 3D printers, made by the Python geometry service. */
export function PrintReadyExport() {
  const online = useServiceOnline();
  const [format, setFormat] = useState<PrintFormat>('stl');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const { serviceGlb } = await import('../../export/serviceModel');
      const { UNIT_TO_MM } = await import('../../export/sceneBuilder');
      const project = useProjectStore.getState().project;
      const name = slugify(project.name);
      const { blob, notes } = await printReadyExport(await serviceGlb(project), {
        format,
        scale: UNIT_TO_MM[project.units],
        name: `${name}-print`,
      });
      downloadBlob(blob, `${name}-print.${format}`);
      notifications.show({ color: 'green', message: notes ?? `Saved ${name}-print.${format}.` });
    } catch (e) {
      notifications.show({
        color: 'red',
        title: 'Print-ready export failed',
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack gap={4}>
      <Group justify="space-between">
        <Text size="xs" fw={600}>
          Print-ready (one joined solid)
        </Text>
        <ServiceBadge />
      </Group>
      <SegmentedControl
        size="xs"
        value={format}
        onChange={(v) => setFormat(v as PrintFormat)}
        data={['stl', '3mf', 'obj', 'ply'].map((f) => ({ value: f, label: f.toUpperCase() }))}
        disabled={!online}
      />
      <Button
        size="xs"
        variant="light"
        onClick={run}
        loading={busy}
        disabled={!online}
        title={online ? undefined : SERVICE_HELP}
        data-testid="export-print-ready"
      >
        Download print-ready file
      </Button>
    </Stack>
  );
}
