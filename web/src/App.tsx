import { AppShell } from '@mantine/core';
import { useEffect } from 'react';

import { detectClaudeSample } from './services/claudeSample';
import { useServiceHealth } from './services/useServiceHealth';
import { migrateLegacyAutosave, startAutosave } from './state/persistence';
import { useUiStore } from './state/uiStore';
import { DrawToolbar } from './ui/DrawToolbar';
import { HomePage } from './ui/HomePage';
import { startNavigation } from './ui/navigation';
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
import { SketchCanvas } from './ui/sketch/SketchCanvas';
import { SketchInspector } from './ui/sketch/SketchInspector';
import { SketchToolbar } from './ui/sketch/SketchToolbar';
import { Toasts } from './ui/Toasts';
import { TopBar, useDetailsPanel } from './ui/TopBar';
import { useKeyboardShortcuts } from './ui/useKeyboardShortcuts';
import { ViewportToolbar } from './ui/ViewportToolbar';
import { Viewport } from './viewport/Viewport';

export function App() {
  const view = useUiStore((s) => s.view);
  const navOpen = useUiStore((s) => s.navOpen);
  const prefs = useUiStore((s) => s.prefs);
  const wide = useWideScreen();
  useServiceHealth();
  useEffect(() => {
    migrateLegacyAutosave();
    void detectClaudeSample();
    const stopNavigation = startNavigation();
    const stopAutosave = startAutosave(
      () => useUiStore.getState().currentProjectId,
      (message) => notifications.show({ color: 'orange', message }),
    );
    return () => {
      stopNavigation();
      stopAutosave();
    };
  }, []);

  const shared = (
    <>
      <PresetsModal />
      <HelpModal />
      <SettingsModal />
      <Toasts />
    </>
  );

  if (view === 'home') {
    return (
      <AppShell
        layout="alt"
        navbar={{
          width: prefs.navCollapsed && wide ? 60 : 268,
          breakpoint: 'sm',
          collapsed: { mobile: !navOpen },
        }}
        padding={0}
      >
        <AppShell.Navbar>
          <Sidebar />
        </AppShell.Navbar>
        <AppShell.Main>
          <HomePage />
        </AppShell.Main>
        {shared}
      </AppShell>
    );
  }
  return <Studio shared={shared} />;
}

function Studio({ shared }: { shared: React.ReactNode }) {
  const navOpen = useUiStore((s) => s.navOpen);
  const asideOpen = useUiStore((s) => s.asideOpen);
  const prefs = useUiStore((s) => s.prefs);
  const wide = useWideScreen();
  const details = useDetailsPanel();
  const mode = useUiStore((s) => s.studioMode);
  useKeyboardShortcuts();

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
        {mode === '2d' ? (
          <SketchInspector onHide={() => details.setShown(false)} />
        ) : (
          <Inspector onHide={() => details.setShown(false)} />
        )}
      </AppShell.Aside>
      <AppShell.Main h="100dvh">
        <div style={{ position: 'relative', height: 'calc(100dvh - 56px)' }}>
          {mode === '2d' ? (
            <>
              <SketchCanvas />
              <SketchToolbar />
            </>
          ) : (
            <>
              <ViewportErrorBoundary>
                <Viewport />
              </ViewportErrorBoundary>
              <ViewportToolbar />
              <DrawToolbar />
              <CutPanel />
            </>
          )}
        </div>
      </AppShell.Main>
      <ExportModal />
      <WelcomeTour />
      {shared}
    </AppShell>
  );
}
