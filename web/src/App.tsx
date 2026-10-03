import { AppShell } from '@mantine/core';
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
import { SettingsModal } from './ui/SettingsModal';
import { Sidebar, useWideScreen } from './ui/Sidebar';
import { Toasts } from './ui/Toasts';
import { TopBar, useDetailsPanel } from './ui/TopBar';
import { useKeyboardShortcuts } from './ui/useKeyboardShortcuts';
import { ViewportToolbar } from './ui/ViewportToolbar';
import { Viewport } from './viewport/Viewport';

export function App() {
  const navOpen = useUiStore((s) => s.navOpen);
  const asideOpen = useUiStore((s) => s.asideOpen);
  const prefs = useUiStore((s) => s.prefs);
  const wide = useWideScreen();
  const details = useDetailsPanel();
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
      layout="alt"
      header={{ height: 56 }}
      navbar={{
        width: prefs.navCollapsed && wide ? 60 : 268,
        breakpoint: 'sm',
        collapsed: { mobile: !navOpen },
      }}
      aside={{
        width: 320,
        breakpoint: 'md',
        collapsed: { mobile: !asideOpen, desktop: prefs.asideHidden },
      }}
      padding={0}
    >
      <AppShell.Header>
        <TopBar />
      </AppShell.Header>
      <AppShell.Navbar>
        <Sidebar />
      </AppShell.Navbar>
      <AppShell.Aside>
        <Inspector onHide={() => details.setShown(false)} />
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
      <SettingsModal />
      <WelcomeTour />
      <Toasts />
    </AppShell>
  );
}
