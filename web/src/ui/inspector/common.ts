import type { SceneNode } from '../../engine/types';
import { useProjectStore } from '../../state/projectStore';

/** Update one node, typed to the node kind the tab works with. */
export function useNodeUpdater<T extends SceneNode>(node: T) {
  const updateNode = useProjectStore((s) => s.updateNode);
  return (recipe: (draft: T) => void) => updateNode(node.id, (d) => recipe(d as T));
}

export function useUnits() {
  return useProjectStore((s) => s.project.units);
}
