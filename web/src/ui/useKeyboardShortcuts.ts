import { useEffect } from 'react';

import { redo, undo } from '../state/projectStore';
import { useUiStore } from '../state/uiStore';
import { deleteSelection, duplicateSelection, groupSelection } from './actions';

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const ui = useUiStore.getState();
      if (mod && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (mod && (key === 'y' || (key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if (mod && key === 'd') {
        e.preventDefault();
        duplicateSelection();
      } else if (mod && key === 'g') {
        e.preventDefault();
        groupSelection();
      } else if (key === 'delete' || key === 'backspace') {
        deleteSelection();
      } else if (key === 'escape') {
        ui.select(null);
      } else if (!mod && key === 'w') {
        ui.setTransformMode('translate');
      } else if (!mod && key === 'e') {
        ui.setTransformMode('rotate');
      } else if (!mod && key === 'r') {
        ui.setTransformMode('scale');
      } else if (!mod && key === 'f') {
        ui.requestFrame();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
