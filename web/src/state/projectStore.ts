import { temporal } from 'zundo';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import { uid } from '../engine/math';
import { createGroupNode, starterProject } from '../engine/project/defaults';
import { cloneSubtree, composeTransforms, descendantIds, topLevelOnly } from '../engine/project/tree';
import type { CustomShape, Project, SceneNode, StoredMesh } from '../engine/types';

export interface ProjectStore {
  project: Project;
  setProject(project: Project): void;
  updateProject(recipe: (draft: Project) => void): void;
  addNode(node: SceneNode): void;
  updateNode(id: string, recipe: (draft: SceneNode) => void): void;
  removeNodes(ids: string[]): void;
  duplicateNodes(ids: string[]): string[];
  groupNodes(ids: string[], name?: string): string | null;
  ungroup(id: string): string[];
  addCustomShape(shape: Omit<CustomShape, 'id'>): string;
  removeCustomShape(id: string): boolean;
  addMesh(mesh: Omit<StoredMesh, 'id'>): string;
}

/** Changes closer together than this (e.g. dragging a slider) become one undo step. */
const UNDO_GROUP_MS = 400;

export const useProjectStore = create<ProjectStore>()(
  temporal(
    immer((set, get) => ({
      project: starterProject(),

      setProject: (project) => set({ project }),

      updateProject: (recipe) =>
        set((s) => {
          recipe(s.project);
        }),

      addNode: (node) =>
        set((s) => {
          s.project.nodes.push(node);
        }),

      updateNode: (id, recipe) =>
        set((s) => {
          const node = s.project.nodes.find((n) => n.id === id);
          if (node) recipe(node);
        }),

      removeNodes: (ids) =>
        set((s) => {
          const remove = new Set<string>();
          for (const id of ids) {
            remove.add(id);
            for (const d of descendantIds(s.project.nodes, id)) remove.add(d);
          }
          s.project.nodes = s.project.nodes.filter((n) => !remove.has(n.id));
        }),

      duplicateNodes: (ids) => {
        const nodes = get().project.nodes;
        const tops = topLevelOnly(nodes, ids);
        const created: SceneNode[] = [];
        const newTops: string[] = [];
        for (const id of tops) {
          const copies = cloneSubtree(nodes, id);
          const top = copies[0];
          top.name = `${top.name} copy`;
          top.transform.position = [
            top.transform.position[0] + 3,
            top.transform.position[1],
            top.transform.position[2],
          ];
          created.push(...copies);
          newTops.push(top.id);
        }
        set((s) => {
          s.project.nodes.push(...created);
        });
        return newTops;
      },

      groupNodes: (ids, name = 'Group') => {
        const nodes = get().project.nodes;
        const tops = topLevelOnly(nodes, ids);
        if (tops.length === 0) return null;
        const parentId = nodes.find((n) => n.id === tops[0])?.parentId ?? null;
        if (!tops.every((id) => nodes.find((n) => n.id === id)?.parentId === parentId)) return null;
        const group = createGroupNode(name);
        group.parentId = parentId;
        // Put the group's origin in the middle of its contents (so it turns around its center).
        const members = nodes.filter((n) => tops.includes(n.id));
        const center = [0, 1, 2].map(
          (k) => members.reduce((sum, n) => sum + n.transform.position[k], 0) / members.length,
        );
        group.transform.position = [center[0], center[1], center[2]];
        set((s) => {
          const firstIndex = s.project.nodes.findIndex((n) => n.id === tops[0]);
          s.project.nodes.splice(Math.max(0, firstIndex), 0, group);
          for (const n of s.project.nodes) {
            if (!tops.includes(n.id)) continue;
            n.parentId = group.id;
            n.transform.position = [
              n.transform.position[0] - center[0],
              n.transform.position[1] - center[1],
              n.transform.position[2] - center[2],
            ];
          }
        });
        return group.id;
      },

      ungroup: (id) => {
        const nodes = get().project.nodes;
        const group = nodes.find((n) => n.id === id);
        if (!group || group.kind !== 'group') return [];
        const childIds = nodes.filter((n) => n.parentId === id).map((n) => n.id);
        set((s) => {
          for (const n of s.project.nodes) {
            if (n.parentId === id) {
              n.transform = composeTransforms(group.transform, n.transform);
              n.parentId = group.parentId;
            }
          }
          s.project.nodes = s.project.nodes.filter((n) => n.id !== id);
        });
        return childIds;
      },

      addCustomShape: (shape) => {
        const id = uid('custom');
        set((s) => {
          s.project.library.push({ ...shape, id });
        });
        return id;
      },

      removeCustomShape: (id) => {
        const inUse = get().project.nodes.some(
          (n) => n.kind !== 'group' && n.source.kind === 'custom' && n.source.customId === id,
        );
        if (inUse) return false;
        set((s) => {
          s.project.library = s.project.library.filter((c) => c.id !== id);
        });
        return true;
      },

      addMesh: (mesh) => {
        const id = uid('mesh');
        set((s) => {
          s.project.meshes.push({ ...mesh, id });
        });
        return id;
      },
    })),
    {
      partialize: (s) => ({ project: s.project }),
      equality: (a, b) => a.project === b.project,
      limit: 100,
      handleSet: (handleSet) => {
        let last = 0;
        return (...args: Parameters<typeof handleSet>) => {
          const now = Date.now();
          if (now - last > UNDO_GROUP_MS) (handleSet as (...a: unknown[]) => void)(...args);
          last = now;
        };
      },
    },
  ),
);

export const undo = () => useProjectStore.temporal.getState().undo();
export const redo = () => useProjectStore.temporal.getState().redo();
export const clearHistory = () => useProjectStore.temporal.getState().clear();
