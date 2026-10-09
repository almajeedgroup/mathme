import { migrateProject } from '../engine/project/migrate';
import {
  getMeta,
  mergeRemote,
  onProjectDeleted,
  onProjectSaved,
  type ProjectMeta,
  readProject,
  updateMeta,
  useProjectList,
  writeProject,
} from '../state/persistence';
import { notifications } from '../ui/notify';
import { useAccount } from './accountStore';
import { api, ApiError } from './api';
import { useUpgradePrompt } from './limits';

/**
 * Cloud saves for signed-in users. Projects are always saved on the device first; a few seconds later the
 * cloud copy is updated. Over the plan's cloud limit a project simply stays on the device.
 */

const UPLOAD_DELAY_MS = 3000;
const timers = new Map<string, ReturnType<typeof setTimeout>>();
let warnedLimit = false;

interface RemoteProject {
  id: string;
  name: string;
  objects: number;
  version: number;
  updatedAt: number;
  hasThumb: boolean;
  shared: boolean;
}

function schedule(id: string) {
  clearTimeout(timers.get(id));
  timers.set(
    id,
    setTimeout(() => void upload(id), UPLOAD_DELAY_MS),
  );
}

/** Save one project to the cloud now. Returns true when the cloud copy is up to date. */
export async function upload(id: string, force = false): Promise<boolean> {
  timers.delete(id);
  const meta = getMeta(id);
  const project = readProject(id);
  if (!meta || !project || meta.remote) return false;
  if (meta.cloud?.state === 'device' && !force) return false;
  updateMeta(id, { cloud: { version: meta.cloud?.version ?? 0, state: 'pending' } });
  try {
    const r = await api<{ version: number }>(`/api/projects/${id}`, {
      method: 'PUT',
      body: {
        name: project.name,
        objects: meta.objects,
        baseVersion: meta.cloud?.version ?? 0,
        data: project,
        thumb: meta.thumb?.startsWith('data:image/jpeg') ? meta.thumb : null,
        force,
      },
    });
    updateMeta(id, { cloud: { version: r.version, state: 'synced' } });
    return true;
  } catch (e) {
    if (e instanceof ApiError && e.status === 409 && !force) {
      notifications.show({
        color: 'orange',
        message: `“${project.name}” was also changed on another device. The version on this device has been kept.`,
      });
      return upload(id, true);
    }
    if (e instanceof ApiError && e.status === 402) {
      updateMeta(id, { cloud: { version: meta.cloud?.version ?? 0, state: 'device' } });
      if (!warnedLimit) {
        warnedLimit = true;
        notifications.show({
          color: 'violet',
          title: 'Saved on this device',
          message: `${e.message}`,
        });
      }
      return false;
    }
    // offline or a server hiccup: try again with the next save
    updateMeta(id, { cloud: { version: meta.cloud?.version ?? 0, state: 'pending' } });
    return false;
  }
}

/** Fetch the cloud project list and add cloud-only projects to the home page. */
export async function syncList() {
  try {
    const r = await api<{ projects: RemoteProject[] }>('/api/projects');
    mergeRemote(
      r.projects.map((p): ProjectMeta => ({
        id: p.id,
        name: p.name,
        objects: p.objects,
        updatedAt: p.updatedAt * 1000,
        cloud: { version: p.version, state: 'synced' },
        remote: true,
        thumbUrl: p.hasThumb ? `/api/projects/${p.id}/thumb?v=${p.version}` : undefined,
      })),
    );
    useProjectList.setState((s) => ({
      items: s.items.map((m) => ({ ...m, shared: r.projects.find((p) => p.id === m.id)?.shared ?? false })),
    }));
  } catch {
    /* offline: the device list still works */
  }
}

/** Download a cloud project to this device (before opening it). */
export async function download(id: string): Promise<boolean> {
  try {
    const r = await api<{ data: unknown; version: number }>(`/api/projects/${id}`);
    const loaded = migrateProject(r.data);
    if (!loaded.ok) throw new Error(loaded.error);
    const thumbUrl = getMeta(id)?.thumbUrl;
    writeProject(id, loaded.project, undefined, false);
    updateMeta(id, (m) => ({
      ...m,
      remote: false,
      thumbUrl,
      cloud: { version: r.version, state: 'synced' },
    }));
    return true;
  } catch (e) {
    notifications.show({
      color: 'red',
      message: e instanceof Error ? e.message : 'Could not open that project.',
    });
    return false;
  }
}

/** Projects that are only on this device (candidates for "move to the cloud"). */
export function deviceOnly(): ProjectMeta[] {
  return useProjectList.getState().items.filter((m) => !m.remote && (!m.cloud || m.cloud.state === 'device'));
}

/** Move device projects up, newest first, as far as the plan allows. Returns how many moved. */
export async function moveUp(ids: string[]): Promise<number> {
  let moved = 0;
  for (const id of ids) {
    updateMeta(id, (m) => ({
      ...m,
      cloud: m.cloud?.state === 'device' ? { ...m.cloud, state: 'pending' } : m.cloud,
    }));
    if (await upload(id)) moved++;
    else if (getMeta(id)?.cloud?.state === 'device') break;
  }
  return moved;
}

export async function shareToClass(id: string, shared: boolean) {
  if (!getMeta(id)?.cloud || getMeta(id)?.cloud?.state !== 'synced') await upload(id);
  await api(`/api/projects/${id}/share`, { method: 'POST', body: { shared } });
  notifications.show({ message: shared ? 'Shared with your class.' : 'No longer shared.' });
  await syncList();
}

/** Start cloud saving for the signed-in user. Returns a stop function. */
export function startCloud(): () => void {
  onProjectSaved((id) => {
    if (useAccount.getState().me.user) schedule(id);
  });
  onProjectDeleted((meta) => {
    if (meta.cloud || meta.remote)
      void api(`/api/projects/${meta.id}`, { method: 'DELETE' }).catch(() => undefined);
  });
  void syncList();
  return () => {
    onProjectSaved(null);
    onProjectDeleted(null);
    for (const t of timers.values()) clearTimeout(t);
  };
}

/** Over the limit: explain with the upgrade prompt (used by the "move to cloud" button). */
export function explainCloudLimit() {
  const limit = useAccount.getState().me.limits.cloudProjects;
  useUpgradePrompt.getState().show({
    title: 'More cloud projects',
    message: `Your plan keeps ${limit} projects in the cloud. The rest stay safely on this device.`,
    plan: useAccount.getState().me.plan === 'free' ? 'plus' : 'pro',
    signIn: false,
  });
}
