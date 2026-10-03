import { Alert, Button, Group, Stack, Text } from '@mantine/core';
import { useState } from 'react';

import { encodeFloat32, encodeUint32 } from '../../engine/binary';
import { createObjectNode } from '../../engine/project/defaults';
import type { SceneNode } from '../../engine/types';
import { booleanModels, type BooleanOperation } from '../../services/geometryApi';
import { asUndoStep, useProjectStore } from '../../state/projectStore';
import { useUiStore } from '../../state/uiStore';
import { notifications } from '../notify';
import { ServiceBadge, SERVICE_HELP, useServiceOnline } from './ServiceStatus';

const OPS: { op: BooleanOperation; label: string; symbol: string; help: string }[] = [
  { op: 'union', label: 'Join', symbol: '+', help: 'Melt both into one shape.' },
  {
    op: 'difference',
    label: 'Cut',
    symbol: '−',
    help: 'Cut the second shape out of the first (make holes!).',
  },
  { op: 'intersection', label: 'Overlap', symbol: '∩', help: 'Keep only the part where they overlap.' },
];

/** Combine, cut or overlap two selected things (needs the Python service). */
export function BooleanTools({ nodes }: { nodes: SceneNode[] }) {
  const online = useServiceOnline();
  const [busy, setBusy] = useState<BooleanOperation | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (nodes.length !== 2) return null;
  const [a, b] = nodes;

  const run = async (op: BooleanOperation, symbol: string) => {
    setBusy(op);
    setError(null);
    try {
      const { glbToTriangles, serviceGlb } = await import('../../export/serviceModel');
      const project = useProjectStore.getState().project;
      const [glbA, glbB] = await Promise.all([serviceGlb(project, [a.id]), serviceGlb(project, [b.id])]);
      const tri = await glbToTriangles(await booleanModels(glbA, glbB, op));
      const name = `${a.name} ${symbol} ${b.name}`;
      const color = a.kind !== 'group' ? a.material.color : undefined;
      asUndoStep(() => {
        const store = useProjectStore.getState();
        const meshId = store.addMesh({
          name,
          positions: encodeFloat32(tri.positions),
          indices: encodeUint32(tri.indices),
        });
        const node = createObjectNode(
          { kind: 'shape', shape: { type: 'mesh', params: { meshId } } },
          name,
          color,
        );
        store.addNode(node);
        for (const n of [a, b]) store.updateNode(n.id, (d) => void (d.visible = false));
        useUiStore.getState().select(node.id);
      });
      notifications.show({
        color: 'green',
        message: `Made “${name}”. The two originals are hidden (click the eye to show them).`,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Stack gap={6} mt="sm">
      <Group justify="space-between">
        <Text size="sm" fw={600}>
          Combine the two shapes
        </Text>
        <ServiceBadge />
      </Group>
      <Text size="xs" c="dimmed">
        First = “{a.name}”, second = “{b.name}”.
      </Text>
      <Group gap={6} grow>
        {OPS.map((o) => (
          <Button
            key={o.op}
            size="xs"
            variant="light"
            loading={busy === o.op}
            disabled={!online || (busy !== null && busy !== o.op)}
            title={online ? o.help : SERVICE_HELP}
            onClick={() => run(o.op, o.symbol)}
            data-testid={`boolean-${o.op}`}
          >
            {o.symbol} {o.label}
          </Button>
        ))}
      </Group>
      {error && (
        <Alert color="red" p="xs">
          {error}
        </Alert>
      )}
    </Stack>
  );
}
