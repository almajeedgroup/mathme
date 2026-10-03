import { parseProjectJson } from '../engine/project/migrate';
import type { Project } from '../engine/types';
import { useProjectStore } from './projectStore';

export const AUTOSAVE_KEY = 'mathme.autosave.v1';
const AUTOSAVE_DELAY_MS = 600;

export function loadAutosave(): Project | null {
  try {
    const text = localStorage.getItem(AUTOSAVE_KEY);
    if (!text) return null;
    const result = parseProjectJson(text);
    return result.ok ? result.project : null;
  } catch {
    return null;
  }
}

/** Save the project to this browser shortly after every change. Returns a stop function. */
export function startAutosave(onError: (message: string) => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let warned = false;
  const save = (project: Project) => {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(project));
    } catch {
      if (!warned) {
        warned = true;
        onError(
          'Your browser storage is full, so autosave is off. Use “Save project file” to keep your work.',
        );
      }
    }
  };
  const unsubscribe = useProjectStore.subscribe((state, prev) => {
    if (state.project === prev.project) return;
    clearTimeout(timer);
    timer = setTimeout(() => save(state.project), AUTOSAVE_DELAY_MS);
  });
  const flush = () => save(useProjectStore.getState().project);
  window.addEventListener('beforeunload', flush);
  return () => {
    unsubscribe();
    clearTimeout(timer);
    window.removeEventListener('beforeunload', flush);
  };
}
