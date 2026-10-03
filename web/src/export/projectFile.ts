import { parseProjectJson, type LoadResult } from '../engine/project/migrate';
import type { Project } from '../engine/types';
import { downloadBlob, slugify } from './download';

export function projectFileName(project: Project): string {
  return `${slugify(project.name)}.mathme.json`;
}

export function saveProjectFile(project: Project) {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  downloadBlob(blob, projectFileName(project));
}

export async function readProjectFile(file: File): Promise<LoadResult> {
  if (file.size > 50 * 1024 * 1024) return { ok: false, error: 'That file is too big to be a project.' };
  return parseProjectJson(await file.text());
}
