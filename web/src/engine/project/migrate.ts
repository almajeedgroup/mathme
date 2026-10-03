import { PROJECT_APP_ID, PROJECT_VERSION, projectSchema } from './schema';
import type { Project } from '../types';

export type LoadResult = { ok: true; project: Project } | { ok: false; error: string };

/**
 * Upgrade older project files to the current version, then check them.
 * (Version 1 is the first version, so there is nothing to upgrade yet.)
 */
export function migrateProject(raw: unknown): LoadResult {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'This is not a MathMe project file.' };
  const data = raw as { app?: unknown; version?: unknown };
  if (data.app !== PROJECT_APP_ID) return { ok: false, error: 'This is not a MathMe project file.' };
  if (typeof data.version !== 'number' || data.version > PROJECT_VERSION)
    return {
      ok: false,
      error: 'This project was made with a newer version of MathMe. Please update the app.',
    };
  const parsed = projectSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: `The project file is damaged (${issue?.path.join('.') || 'unknown'}: ${issue?.message}).`,
    };
  }
  return { ok: true, project: parsed.data };
}

export function parseProjectJson(text: string): LoadResult {
  try {
    return migrateProject(JSON.parse(text));
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' };
  }
}
