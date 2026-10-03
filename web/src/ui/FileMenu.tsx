import { ActionIcon, FileButton, Menu, Tooltip } from '@mantine/core';
import { IconFile, IconFileImport, IconDeviceFloppy, IconFilePlus, IconBulb } from '@tabler/icons-react';
import { useRef } from 'react';

import { emptyProject } from '../engine/project/defaults';
import { readProjectFile, saveProjectFile } from '../export/projectFile';
import { useProjectStore } from '../state/projectStore';
import { useUiStore } from '../state/uiStore';
import { loadProject } from './actions';
import { notifications } from './notify';

export function FileMenu() {
  const setOpen = useUiStore((s) => s.setOpen);
  const resetRef = useRef<() => void>(null);
  return (
    <Menu shadow="md" width={230} position="bottom-start">
      <Menu.Target>
        <Tooltip label="File">
          <ActionIcon variant="default" size="lg" aria-label="File menu">
            <IconFile size={18} />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          leftSection={<IconFilePlus size={16} />}
          onClick={() => {
            loadProject(emptyProject());
            notifications.show({ message: 'New empty scene. Press Undo to get the old one back.' });
          }}
        >
          New empty scene
        </Menu.Item>
        <Menu.Item leftSection={<IconBulb size={16} />} onClick={() => setOpen('presetsOpen', true)}>
          Ideas…
        </Menu.Item>
        <Menu.Divider />
        <FileButton
          resetRef={resetRef}
          accept=".json,application/json"
          onChange={async (file) => {
            if (!file) return;
            const result = await readProjectFile(file);
            resetRef.current?.();
            if (result.ok) {
              loadProject(result.project);
              notifications.show({ color: 'green', message: `Opened “${result.project.name}”.` });
            } else {
              notifications.show({ color: 'red', title: 'Could not open file', message: result.error });
            }
          }}
        >
          {(props) => (
            <Menu.Item leftSection={<IconFileImport size={16} />} {...props} closeMenuOnClick={false}>
              Open project file…
            </Menu.Item>
          )}
        </FileButton>
        <Menu.Item
          leftSection={<IconDeviceFloppy size={16} />}
          onClick={() => saveProjectFile(useProjectStore.getState().project)}
        >
          Save project file
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
