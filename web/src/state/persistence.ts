import { create } from 'zustand';

import { countObjects } from '../engine/evaluate';
import { uid } from '../engine/math';
import { parseProjectJson } from '../engine/project/migrate';
import type { Project } from '../engine/types';
import { useProjectStore } from './projectStore';

/**
 * Projects are kept in this browser: a small index (names, dates, thumbnails) and one entry per project.
 * Nothing is sent anywhere.
 */
export const INDEX_KEY = 'mathme.projects.v1';
const PROJECT_PREFIX = 'mathme.project.';
const LAST_KEY = 'mathme.lastProject';
/** Where older versions kept their single autosaved project. */
export const LEGACY_AUTOSAVE_KEY = 'mathme.autosave.v1';
const AUTOSAVE_DELAY_MS = 600;
const THUMB_EVERY_MS = 3000;

export interface ProjectMeta {
  id: string;
  name: string;
  updatedAt: number;
  objects: number;
  /** A small JPEG of the 3D view, as a data URL. */
  thumb?: string;
  /**
   * Cloud copy (signed in with accounts on): `version` of the last saved copy, and where it stands.
   * synced = up to date; pending = changed here, not uploaded yet; device = over the plan's cloud limit.
   */
  cloud?: { version: number; state: 'synced' | 'pending' | 'device' };
  /** Only in the cloud so far (download it before opening). */
  remote?: boolean;
  /** Picture address for a cloud-only project. */
  thumbUrl?: string;
  /** Shared with the user's Campus class. */
  shared?: boolean;
}

export const projectKey = (id: string) => PROJECT_PREFIX + id;

function readIndex(): ProjectMeta[] {
  try {
    const list = JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]') as ProjectMeta[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeIndex(list: ProjectMeta[]) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(list));
  } catch {
    // full: drop the thumbnails, which are the biggest part, and try again
    try {
      localStorage.setItem(INDEX_KEY, JSON.stringify(list.map(({ thumb: _thumb, ...m }) => m)));
    } catch {
      /* nothing more we can do */
    }
  }
  useProjectList.setState({ items: sorted(list) });
}

const sorted = (list: ProjectMeta[]) => [...list].sort((a, b) => b.updatedAt - a.updatedAt);

/** The project list, newest first. Components re-render when it changes. */
export const useProjectList = create<{ items: ProjectMeta[] }>(() => ({ items: sorted(readIndex()) }));

export function readProject(id: string): Project | null {
  try {
    const text = localStorage.getItem(projectKey(id));
    if (!text) return null;
    const result = parseProjectJson(text);
    return result.ok ? result.project : null;
  } catch {
    return null;
  }
}

/** Save a project. Returns false when the browser storage is full. */
/** Called after every local save (the cloud layer uploads from here). */
let afterSave: ((id: string, thumb?: string) => void) | null = null;
export function onProjectSaved(fn: typeof afterSave) {
  afterSave = fn;
}

/** Change a project's list entry without touching the project itself. */
export function updateMeta(id: string, patch: Partial<ProjectMeta> | ((m: ProjectMeta) => ProjectMeta)) {
  writeIndex(
    readIndex().map((m) => (m.id === id ? (typeof patch === 'function' ? patch(m) : { ...m, ...patch }) : m)),
  );
}

/** Add list entries for projects that live only in the cloud, and drop cloud-only entries that are gone. */
export function mergeRemote(remote: ProjectMeta[]) {
  const list = readIndex();
  const remoteIds = new Set(remote.map((r) => r.id));
  const kept = list.filter((m) => !m.remote || remoteIds.has(m.id));
  for (const r of remote) {
    const local = kept.find((m) => m.id === r.id);
    if (!local) kept.push(r);
    else if (
      local.cloud &&
      local.cloud.state === 'synced' &&
      r.cloud &&
      r.cloud.version > local.cloud.version
    ) {
      // changed on another device: fetch the newer copy next time it is opened
      Object.assign(local, { ...r, remote: true, thumb: local.thumb });
    }
  }
  writeIndex(kept);
}

export function getMeta(id: string): ProjectMeta | undefined {
  return readIndex().find((m) => m.id === id);
}

export function writeProject(id: string, project: Project, thumb?: string, notify = true): boolean {
  let ok = true;
  try {
    localStorage.setItem(projectKey(id), JSON.stringify(project));
  } catch {
    ok = false;
  }
  const list = readIndex();
  const old = list.find((m) => m.id === id);
  const meta: ProjectMeta = {
    id,
    name: project.name,
    updatedAt: Date.now(),
    objects: countObjects(project),
    thumb: thumb ?? old?.thumb,
    cloud: old?.cloud,
  };
  writeIndex(old ? list.map((m) => (m.id === id ? meta : m)) : [...list, meta]);
  if (notify) afterSave?.(id, thumb);
  return ok;
}

export function createProjectEntry(project: Project): string {
  const id = uid('project');
  writeProject(id, project);
  return id;
}

/** Called before a project is deleted (the cloud layer deletes the cloud copy). */
let beforeDelete: ((meta: ProjectMeta) => void) | null = null;
export function onProjectDeleted(fn: typeof beforeDelete) {
  beforeDelete = fn;
}

export function deleteProject(id: string) {
  const meta = readIndex().find((m) => m.id === id);
  if (meta) beforeDelete?.(meta);
  try {
    localStorage.removeItem(projectKey(id));
  } catch {
    /* already gone */
  }
  writeIndex(readIndex().filter((m) => m.id !== id));
}

export function renameProject(id: string, name: string) {
  const project = readProject(id);
  if (!project) return;
  const list = readIndex();
  const thumb = list.find((m) => m.id === id)?.thumb;
  writeProject(id, { ...project, name }, thumb);
}

export function duplicateProject(id: string): string | null {
  const project = readProject(id);
  if (!project) return null;
  const thumb = readIndex().find((m) => m.id === id)?.thumb;
  const copy = uid('project');
  writeProject(copy, { ...project, name: `${project.name} (copy)` }, thumb);
  return copy;
}

export function lastProjectId(): string | null {
  try {
    const id = localStorage.getItem(LAST_KEY);
    return id && readIndex().some((m) => m.id === id && !m.remote) ? id : null;
  } catch {
    return null;
  }
}

export function setLastProjectId(id: string) {
  try {
    localStorage.setItem(LAST_KEY, id);
  } catch {
    /* private mode */
  }
}

/** Move the single autosaved project of older versions into the project list (once). */
export function migrateLegacyAutosave() {
  try {
    if (localStorage.getItem(INDEX_KEY) !== null) return;
    const text = localStorage.getItem(LEGACY_AUTOSAVE_KEY);
    if (text) {
      const result = parseProjectJson(text);
      if (result.ok) setLastProjectId(createProjectEntry(result.project));
    }
    localStorage.removeItem(LEGACY_AUTOSAVE_KEY);
    if (localStorage.getItem(INDEX_KEY) === null) writeIndex([]);
  } catch {
    /* storage blocked: start fresh */
  }
}

/** A small picture of the 3D view, or undefined if there is none on screen. */
export function captureThumbnail(): string | undefined {
  const source = document.querySelector<HTMLCanvasElement>('[data-testid="viewport"] canvas, canvas');
  if (!source || !source.width || !source.height) return undefined;
  try {
    const w = 320;
    const h = Math.round((w * source.height) / source.width);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d')?.drawImage(source, 0, 0, w, h);
    return c.toDataURL('image/jpeg', 0.72);
  } catch {
    return undefined;
  }
}

/**
 * Save the open project shortly after every change. `currentId` says which project is open.
 * Returns a function that stops autosaving (and saves one last time).
 */
export function startAutosave(
  currentId: () => string | null,
  onError: (message: string) => void,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let warned = false;
  let lastThumb = 0;
  const save = () => {
    const id = currentId();
    if (!id) return;
    const now = Date.now();
    const thumb = now - lastThumb > THUMB_EVERY_MS ? captureThumbnail() : undefined;
    if (thumb) lastThumb = now;
    if (!writeProject(id, useProjectStore.getState().project, thumb) && !warned) {
      warned = true;
      onError('Your browser storage is full, so autosave is off. Use “Save project file” to keep your work.');
    }
  };
  const unsubscribe = useProjectStore.subscribe((state, prev) => {
    if (state.project === prev.project) return;
    clearTimeout(timer);
    timer = setTimeout(save, AUTOSAVE_DELAY_MS);
  });
  window.addEventListener('beforeunload', save);
  return () => {
    unsubscribe();
    clearTimeout(timer);
    window.removeEventListener('beforeunload', save);
  };
}

/** Save the open project now, with a fresh picture (e.g. before going back to the project list). */
export function saveNow(id: string) {
  writeProject(id, useProjectStore.getState().project, captureThumbnail());
}
