import { create } from 'zustand';

/** A tiny toast system (Mantine's notifications package is not needed for this). */
export interface Toast {
  id: number;
  message: string;
  color?: string;
  title?: string;
}

interface ToastState {
  toasts: Toast[];
  show(t: Omit<Toast, 'id'>): void;
  hide(id: number): void;
}

let next = 1;

export const useToasts = create<ToastState>()((set, get) => ({
  toasts: [],
  show: (t) => {
    const id = next++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }));
    setTimeout(() => get().hide(id), 5000);
  },
  hide: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export const notifications = {
  show: (t: Omit<Toast, 'id'>) => useToasts.getState().show(t),
};
