import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import {
  IconCube,
  IconFileTypePdf,
  IconPhoto,
  IconPrinter,
  IconFileCode,
  IconDeviceFloppy,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';

import { countObjects } from '../engine/evaluate';
import { downloadBlob, slugify } from '../export/download';
import { saveProjectFile } from '../export/projectFile';
import type { ModelMode } from '../export/sceneBuilder';
import { useProjectStore } from '../state/projectStore';
import { useUiStore } from '../state/uiStore';
import { notifications } from './notify';
import { PrintReadyExport } from './service/PrintReadyExport';

const PNG_SIZES: Record<string, [number, number]> = {
  hd: [1920, 1080],
  '4k': [3840, 2160],
  square: [2048, 2048],
};

function ExportCard({
  icon,
  title,
  badge,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card withBorder radius="md" padding="sm">
      <Stack gap="xs" h="100%">
        <Group gap="xs">
          {icon}
          <Text fw={700}>{title}</Text>
          {badge && (
            <Badge size="xs" variant="light">
              {badge}
            </Badge>
          )}
        </Group>
        <Text size="xs" c="dimmed">
          {description}
        </Text>
        <Stack gap="xs" mt="auto">
          {children}
        </Stack>
      </Stack>
    </Card>
  );
}

export function ExportModal() {
  const open = useUiStore((s) => s.exportOpen);
  const setOpen = useUiStore((s) => s.setOpen);
  const project = useProjectStore((s) => s.project);
  const updateProject = useProjectStore((s) => s.updateProject);
  const count = useMemo(() => (open ? countObjects(project) : 0), [open, project]);
  const [busy, setBusy] = useState<string | null>(null);
  const [glbMode, setGlbMode] = useState<ModelMode | 'auto'>('auto');
  const [pngSize, setPngSize] = useState('hd');
  const [transparent, setTransparent] = useState(false);
  const base = slugify(project.name);
  const mode: ModelMode = glbMode === 'auto' ? (count > 3000 ? 'merged' : 'separate') : glbMode;

  const run = async (key: string, fn: () => Promise<Blob> | Blob, filename: string) => {
    setBusy(key);
    // let the button show its spinner before the heavy work starts
    await new Promise((r) => setTimeout(r, 30));
    try {
      const blob = await fn();
      downloadBlob(blob, filename);
      notifications.show({
        color: 'green',
        message: `Saved ${filename} (${(blob.size / 1024).toFixed(0)} KB).`,
      });
    } catch (e) {
      // ExportTooBigError already explains what to do; anything else gets a generic message
      const message =
        e instanceof Error && e.name === 'ExportTooBigError'
          ? e.message
          : `Sorry, that export failed: ${e instanceof Error ? e.message : String(e)}`;
      notifications.show({ color: 'red', title: 'Export failed', message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      opened={open}
      onClose={() => setOpen('exportOpen', false)}
      title="Export your artwork"
      size="xl"
      centered
    >
      {count === 0 ? (
        <Alert color="gray">There is nothing to export yet. Add a shape first!</Alert>
      ) : (
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            {count.toLocaleString()} objects. Everything is made right here in your browser.
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <ExportCard
              icon={<IconCube size={20} />}
              title="3D model (GLB)"
              badge="recommended"
              description="Opens in Blender, Windows 3D Viewer, game engines and websites. Sizes are saved in metres."
            >
              <SegmentedControl
                size="xs"
                value={glbMode}
                onChange={(v) => setGlbMode(v as ModelMode | 'auto')}
                data={[
                  { value: 'auto', label: 'Auto' },
                  { value: 'separate', label: 'Separate objects' },
                  { value: 'merged', label: 'One per pattern' },
                ]}
              />
              <Button
                loading={busy === 'glb'}
                onClick={() =>
                  run(
                    'glb',
                    async () => (await import('../export/models')).exportGlb(project, mode),
                    `${base}.glb`,
                  )
                }
                data-testid="export-glb"
              >
                Download .glb
              </Button>
            </ExportCard>

            <ExportCard
              icon={<IconPrinter size={20} />}
              title="3D printing (STL)"
              description="For 3D printer software (slicers). Sizes are saved in millimetres."
            >
              <Button
                variant="light"
                loading={busy === 'stl'}
                onClick={() =>
                  run('stl', async () => (await import('../export/models')).exportStl(project), `${base}.stl`)
                }
                data-testid="export-stl"
              >
                Download .stl
              </Button>
              <PrintReadyExport />
            </ExportCard>

            <ExportCard
              icon={<IconPhoto size={20} />}
              title="Picture (PNG)"
              description="A picture of exactly what you see in the 3D view, for posters and slides."
            >
              <SegmentedControl
                size="xs"
                value={pngSize}
                onChange={setPngSize}
                data={[
                  { value: 'hd', label: 'HD' },
                  { value: '4k', label: '4K poster' },
                  { value: 'square', label: 'Square' },
                ]}
              />
              <Switch
                size="xs"
                label="See-through background"
                checked={transparent}
                onChange={(e) => setTransparent(e.currentTarget.checked)}
              />
              <Button
                variant="light"
                loading={busy === 'png'}
                onClick={() =>
                  run(
                    'png',
                    async () =>
                      (await import('../export/image')).renderPng(
                        project,
                        ...PNG_SIZES[pngSize],
                        transparent,
                      ),
                    `${base}.png`,
                  )
                }
                data-testid="export-png"
              >
                Download .png
              </Button>
            </ExportCard>

            <ExportCard
              icon={<IconFileTypePdf size={20} />}
              title="Project sheet (PDF)"
              description="A printable report: your picture, front/top/side views, every setting, and the maths with measurements."
            >
              <TextInput
                size="xs"
                placeholder="Your name for the sheet"
                value={project.author}
                onChange={(e) => {
                  const author = e.currentTarget.value;
                  updateProject((p) => void (p.author = author));
                }}
              />
              <Button
                variant="light"
                loading={busy === 'pdf'}
                onClick={() =>
                  run('pdf', async () => (await import('../export/pdf')).exportPdf(project), `${base}.pdf`)
                }
                data-testid="export-pdf"
              >
                Download .pdf
              </Button>
            </ExportCard>

            <ExportCard
              icon={<IconFileCode size={20} />}
              title="OBJ"
              description={`A simple 3D format many programs open. Sizes are in ${project.units}.`}
            >
              <Button
                variant="default"
                loading={busy === 'obj'}
                onClick={() =>
                  run('obj', async () => (await import('../export/models')).exportObj(project), `${base}.obj`)
                }
                data-testid="export-obj"
              >
                Download .obj
              </Button>
            </ExportCard>

            <ExportCard
              icon={<IconDeviceFloppy size={20} />}
              title="Project file"
              description="Save your work to keep editing later, or share it with a friend or teacher (File → Open)."
            >
              <Button variant="default" onClick={() => saveProjectFile(project)} data-testid="export-project">
                Download .mathme.json
              </Button>
            </ExportCard>
          </SimpleGrid>
        </Stack>
      )}
    </Modal>
  );
}
