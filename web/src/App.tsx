import { AppShell, Divider, ScrollArea, Stack } from '@mantine/core';
import { useEffect } from 'react';

import { loadAutosave, startAutosave } from './state/persistence';
import { clearHistory, useProjectStore } from './state/projectStore';
import { useUiStore } from './state/uiStore';
import { notifications } from './ui/notify';
import { ExportModal } from './ui/ExportModal';
import { PresetsModal } from './ui/PresetsModal';
import { Inspector } from './ui/inspector/Inspector';
import { Outliner } from './ui/Outliner';
import { PatternPicker } from './ui/PatternPicker';
import { ShapeLibrary } from './ui/ShapeLibrary';
import { Toasts } from './ui/Toasts';
import { TopBar } from './ui/TopBar';
import { useKeyboardShortcuts } from './ui/useKeyboardShortcuts';
import { ViewportToolbar } from './ui/ViewportToolbar';
import { Viewport } from './viewport/Viewport';

export function App() {
  const navOpen = useUiStore((s) => s.navOpen);
  const asideOpen = useUiStore((s) => s.asideOpen);
  const requestFrame = useUiStore((s) => s.requestFrame);
  useKeyboardShortcuts();
  useEffect(() => {
    const saved = loadAutosave();
    if (saved) {
      useProjectStore.getState().setProject(saved);
      clearHistory();
    }
    requestFrame();
    return startAutosave((message) => notifications.show({ color: 'orange', message }));
  }, [requestFrame]);

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 290, breakpoint: 'sm', collapsed: { mobile: !navOpen } }}
      aside={{ width: 350, breakpoint: 'md', collapsed: { mobile: !asideOpen } }}
      padding={0}
    >
      <AppShell.Header>
        <TopBar />
      </AppShell.Header>
      <AppShell.Navbar>
        <ScrollArea h="100%" type="auto" offsetScrollbars>
          <Stack p="sm" gap="md">
            <ShapeLibrary />
            <Divider />
            <PatternPicker />
            <Divider />
            <Outliner />
          </Stack>
        </ScrollArea>
      </AppShell.Navbar>
      <AppShell.Aside>
        <Inspector />
      </AppShell.Aside>
      <AppShell.Main h="100dvh">
        <div style={{ position: 'relative', height: 'calc(100dvh - 60px)' }}>
          <Viewport />
          <ViewportToolbar />
        </div>
      </AppShell.Main>
      <PresetsModal />
      <ExportModal />
      <Toasts />
    </AppShell>
  );
}
