import { List, Select, Stack, Text, TextInput } from '@mantine/core';

import type { Units } from '../../engine/types';
import { useProjectStore } from '../../state/projectStore';
import { ColorPicker } from './LookTab';

export function ProjectTab() {
  const project = useProjectStore((s) => s.project);
  const updateProject = useProjectStore((s) => s.updateProject);
  return (
    <Stack gap="sm">
      <Text fw={700}>Your project</Text>
      <TextInput
        size="xs"
        label="Project name"
        value={project.name}
        onChange={(e) => updateProject((p) => void (p.name = e.currentTarget.value))}
      />
      <TextInput
        size="xs"
        label="Made by"
        placeholder="Your name (shown on the PDF)"
        value={project.author}
        onChange={(e) => updateProject((p) => void (p.author = e.currentTarget.value))}
      />
      <Select
        size="xs"
        label="Units"
        description="What one grid square means. Sizes are shown in these units."
        data={[
          { value: 'mm', label: 'Millimetres (mm)' },
          { value: 'cm', label: 'Centimetres (cm)' },
          { value: 'm', label: 'Metres (m)' },
        ]}
        value={project.units}
        allowDeselect={false}
        onChange={(v) => v && updateProject((p) => void (p.units = v as Units))}
      />
      <ColorPicker
        label="Background colour"
        value={project.background}
        onChange={(c) => updateProject((p) => void (p.background = c))}
      />
      <Text fw={600} size="sm" mt="sm">
        Tips
      </Text>
      <List size="xs" spacing={4}>
        <List.Item>Click an object to select it. Shift + click selects more than one.</List.Item>
        <List.Item>
          Drag with the left mouse button to turn the camera, right button to slide, wheel to zoom.
        </List.Item>
        <List.Item>Type a recipe in the box at the top, e.g. “100 spheres → spiral → radius 20”.</List.Item>
        <List.Item>Ctrl+Z undoes a mistake. Ctrl+Y redoes it.</List.Item>
      </List>
    </Stack>
  );
}
