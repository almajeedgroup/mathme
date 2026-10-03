import { emptyProject, starterProject } from '../engine/project/defaults';
import type { Project } from '../engine/types';
import { ensureLinkedMeshes } from '../services/modelAssets';
import {
  createProjectEntry,
  lastProjectId,
  readProject,
  saveNow,
  setLastProjectId,
} from '../state/persistence';
import { clearHistory, useProjectStore } from '../state/projectStore';
import { useUiStore } from '../state/uiStore';
import { notifications } from './notify';
import { useSketchUi } from './sketch/sketchStore';

const STUDIO_HASH = '#studio';

function setHash(hash: string) {
  try {
    if (location.hash === hash) return;
    history.pushState(null, '', hash || location.pathname + location.search);
  } catch {
    /* some hosts block history changes; the app still works */
  }
}

/** Put a project on screen as a fresh start (no undo back into the previous project). */
function showProject(project: Project) {
  const ui = useUiStore.getState();
  useProjectStore.getState().setProject(project);
  clearHistory();
  ui.select(null);
  ui.resetCut();
  ui.requestFrame();
  useSketchUi
    .getState()
    .set({ selection: [], shape: null, chainFrom: null, chainStart: null, circleCentre: null, unmet: [] });
  ensureLinkedMeshes(project).catch((e: Error) =>
    notifications.show({ color: 'red', message: `A linked 3D model could not be loaded: ${e.message}` }),
  );
}

export function openProject(id: string): boolean {
  const project = readProject(id);
  if (!project) {
    notifications.show({ color: 'red', message: 'That project could not be opened.' });
    return false;
  }
  showProject(project);
  useUiStore.setState({ view: 'studio', currentProjectId: id, navOpen: false });
  setLastProjectId(id);
  setHash(STUDIO_HASH);
  return true;
}

/** Add a project to the list and open it. */
export function startNewProject(project: Project = emptyProject()): string {
  const id = createProjectEntry(project);
  openProject(id);
  return id;
}

/** Save the open project (with a fresh picture) and go back to the project list. */
export function goHome() {
  const id = useUiStore.getState().currentProjectId;
  if (id) saveNow(id);
  useUiStore.setState({ view: 'home', currentProjectId: null, navOpen: false, cutOpen: false });
  setHash('');
}

/** Decide what to show when the app starts, and follow the browser's Back and Forward buttons. */
export function startNavigation(): () => void {
  const sync = () => {
    const wantStudio = location.hash === STUDIO_HASH;
    const { view } = useUiStore.getState();
    if (wantStudio && view !== 'studio') {
      const id = lastProjectId();
      if (!id || !openProject(id)) startNewProject(starterProject());
    } else if (!wantStudio && view !== 'home') {
      goHome();
    }
  };
  sync();
  window.addEventListener('popstate', sync);
  return () => window.removeEventListener('popstate', sync);
}
