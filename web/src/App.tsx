import { AppShell, ScrollArea, Stack } from '@mantine/core';
import { useEffect } from 'react';

import { ensureLinkedMeshes } from './services/modelAssets';
import { useServiceHealth } from './services/useServiceHealth';
import { loadAutosave, startAutosave } from './state/persistence';
import { clearHistory, useProjectStore } from './state/projectStore';
import { useUiStore } from './state/uiStore';
import { notifications } from './ui/notify';
import { CutPanel } from './ui/CutPanel';
import { ExportModal } from './ui/ExportModal';
import { HelpModal } from './ui/HelpModal';
import { WelcomeTour } from './ui/WelcomeTour';
import { ViewportErrorBoundary } from './viewport/ViewportErrorBoundary';
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
  useServiceHealth();
  useEffect(() => {
    const saved = loadAutosave();
    if (saved) {
      useProjectStore.getState().setProject(saved);
      clearHistory();
      ensureLinkedMeshes(saved).catch((e) =>
        notifications.show({ color: 'red', message: `A linked 3D model could not be loaded: ${e.message}` }),
      );
    }
    requestFrame();
    return startAutosave((message) => notifications.show({ color: 'orange', message }));
  }, [requestFrame]);

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 264, breakpoint: 'sm', collapsed: { mobile: !navOpen } }}
      aside={{ width: 320, breakpoint: 'md', collapsed: { mobile: !asideOpen } }}
      padding={0}
    >
      <AppShell.Header>
        <TopBar />
      </AppShell.Header>
      <AppShell.Navbar>
        <ScrollArea h="100%" type="auto" offsetScrollbars>
          <Stack p="sm" gap="lg">
            <ShapeLibrary />
            <PatternPicker />
            <Outliner />
          </Stack>
        </ScrollArea>
      </AppShell.Navbar>
      <AppShell.Aside>
        <Inspector />
      </AppShell.Aside>
      <AppShell.Main h="100dvh">
        <div style={{ position: 'relative', height: 'calc(100dvh - 56px)' }}>
          <ViewportErrorBoundary>
            <Viewport />
          </ViewportErrorBoundary>
          <ViewportToolbar />
          <CutPanel />
        </div>
      </AppShell.Main>
      <PresetsModal />
      <ExportModal />
      <HelpModal />
      <WelcomeTour />
      <Toasts />
    </AppShell>
  );
}
