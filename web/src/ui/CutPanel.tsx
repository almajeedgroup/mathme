import {
  ActionIcon,
  Button,
  Code,
  Group,
  Paper,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { useState } from 'react';
import { Vector3 } from 'three';

import { anglesFromCut, anglesToAxes, planeFromAngles } from '../engine/cutPlane';
import { fmt } from '../engine/math';
import { downloadBlob, slugify } from '../export/download';
import { sliceModel } from '../services/geometryApi';
import { useProjectStore } from '../state/projectStore';
import { useUiStore, type CutMode } from '../state/uiStore';
import { contentBounds } from '../viewport/bounds';
import { viewportBridge } from '../viewport/bridge';
import { NumberSliderField } from './fields/NumberSliderField';
import { notifications } from './notify';
import { SERVICE_HELP, useServiceOnline } from './service/ServiceStatus';

/** Measure the model so the cut starts in its middle and the sliders fit its size. */
export function openCutTool() {
  const ui = useUiStore.getState();
  const content = viewportBridge.content;
  const box = content ? contentBounds(content) : null;
  if (box && !box.isEmpty()) {
    const c = box.getCenter(new Vector3());
    const size = Math.max(1, box.max.distanceTo(box.min));
    ui.setCut({ centre: [c.x, c.y, c.z], size, mode: ui.cut.mode === 'off' ? 'a' : ui.cut.mode });
  } else {
    ui.setCut({ mode: 'a' });
  }
  ui.setCutOpen(true);
}

export function applyCutPreset(id: string) {
  const preset = useProjectStore.getState().project.cutPresets?.find((p) => p.id === id);
  if (!preset) return;
  const ui = useUiStore.getState();
  const a = anglesFromCut(preset.point, preset.normal, ui.cut.centre);
  ui.setCut({ ...a, presetId: id, mode: ui.cut.mode === 'off' ? 'a' : ui.cut.mode });
  lookAtCut();
}

/** Turn the camera to face the cut surface of the half that is shown. */
export function lookAtCut() {
  const { cut, lookAlong } = useUiStore.getState();
  if (cut.mode === 'off') return;
  const eq = planeFromAngles(cut, cut.centre);
  const n = eq.normal;
  // the kept half's cut face points away from the kept side, so look from the removed side
  lookAlong(cut.mode === 'a' ? n : [-n[0], -n[1], -n[2]], { n, d: eq.d });
}

export function CutPanel() {
  const open = useUiStore((s) => s.cutOpen);
  const cut = useUiStore((s) => s.cut);
  const setCut = useUiStore((s) => s.setCut);
  const setCutOpen = useUiStore((s) => s.setCutOpen);
  const presets = useProjectStore((s) => s.project.cutPresets);
  const units = useProjectStore((s) => s.project.units);
  const online = useServiceOnline();
  const [busy, setBusy] = useState(false);
  if (!open) return null;

  const eq = planeFromAngles(cut, cut.centre);
  const ax = anglesToAxes(eq.normal);
  const half = cut.size / 2;

  const exportCut = async () => {
    setBusy(true);
    try {
      const project = useProjectStore.getState().project;
      const { serviceGlb } = await import('../export/serviceModel');
      const { UNIT_TO_MM } = await import('../export/sceneBuilder');
      const name = `${slugify(project.name)}-cut`;
      const { blob, notes } = await sliceModel(await serviceGlb(project), {
        point: eq.point,
        normal: eq.normal,
        scale: UNIT_TO_MM[project.units],
        name,
      });
      downloadBlob(blob, `${name}.zip`);
      notifications.show({
        color: 'green',
        message: notes ?? `Saved ${name}.zip (both halves as GLB, one STL per half).`,
      });
    } catch (e) {
      notifications.show({
        color: 'red',
        title: 'Cut export failed',
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Paper
      shadow="md"
      radius="md"
      p="sm"
      withBorder
      data-testid="cut-panel"
      style={{
        position: 'absolute',
        left: 12,
        bottom: 12,
        width: 320,
        maxWidth: 'calc(100% - 24px)',
        zIndex: 20,
      }}
    >
      <ScrollArea.Autosize mah="60dvh" type="auto">
        <Stack gap="xs">
          <Group justify="space-between" wrap="nowrap">
            <Text fw={700}>Cut through the model</Text>
            <ActionIcon variant="subtle" onClick={() => setCutOpen(false)} aria-label="Close cut tool">
              <IconX size={16} />
            </ActionIcon>
          </Group>
          <SegmentedControl
            size="xs"
            fullWidth
            value={cut.mode}
            onChange={(v) => {
              setCut({ mode: v as CutMode });
              lookAtCut();
            }}
            data={[
              { value: 'off', label: 'Off' },
              { value: 'a', label: 'Keep side A' },
              { value: 'b', label: 'Keep side B' },
            ]}
          />
          {presets && presets.length > 0 && (
            <Select
              size="xs"
              label="Standard views"
              placeholder="Pick a view"
              data-testid="cut-preset"
              data={[
                {
                  group: 'Cardiac views',
                  items: presets
                    .filter((p) => !/^(axial|coronal|sagittal)/.test(p.id))
                    .map((p) => ({ value: p.id, label: p.name })),
                },
                {
                  group: 'Anatomical planes',
                  items: presets
                    .filter((p) => /^(axial|coronal|sagittal)/.test(p.id))
                    .map((p) => ({ value: p.id, label: p.name })),
                },
              ]}
              value={cut.presetId}
              onChange={(v) => v && applyCutPreset(v)}
              searchable
            />
          )}
          <NumberSliderField
            label="Tilt"
            help="0° = a flat (horizontal) cut, 90° = a standing (vertical) cut."
            value={cut.tilt}
            min={0}
            max={180}
            step={1}
            suffix="°"
            onChange={(tilt) => setCut({ tilt, presetId: null })}
          />
          <NumberSliderField
            label="Turn"
            help="Which way the cut faces, turning around the up-down axis."
            value={cut.turn}
            min={-180}
            max={180}
            step={1}
            suffix="°"
            onChange={(turn) => setCut({ turn, presetId: null })}
          />
          <NumberSliderField
            label="Slide"
            help="Move the cut along its own direction, through the model."
            value={cut.shift}
            min={-half}
            max={half}
            step={Math.max(0.01, cut.size / 400)}
            suffix={units}
            onChange={(shift) => setCut({ shift, presetId: null })}
          />
          <Code block fz={10}>
            {`n = (${eq.normal.map((v) => fmt(v, 3)).join(', ')})\n`}
            {`plane:  n · x = ${fmt(eq.d, 3)} ${units}\n`}
            {`angle to x: ${fmt(ax.x, 0)}°   y: ${fmt(ax.y, 0)}°   z: ${fmt(ax.z, 0)}°`}
          </Code>
          <Button
            size="xs"
            variant="default"
            onClick={lookAtCut}
            disabled={cut.mode === 'off'}
            data-testid="look-at-cut"
          >
            Look at the cut face
          </Button>
          <Text size="xs" c="dimmed">
            Side A is the side the arrow n points to. Use Export → PNG for a picture of the cut.
          </Text>
          <Tooltip
            label={online ? 'Both halves with closed cut faces (GLB + STL)' : SERVICE_HELP}
            multiline
            w={260}
          >
            <Button
              size="xs"
              variant="light"
              onClick={exportCut}
              loading={busy}
              disabled={!online}
              data-testid="export-cut"
            >
              Export this cut (both halves)
            </Button>
          </Tooltip>
        </Stack>
      </ScrollArea.Autosize>
    </Paper>
  );
}
