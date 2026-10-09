import { create } from 'zustand';

import type { Period, PlanId } from './plans';

/** Which account screens are open. */
interface AccountUi {
  pricing: boolean;
  checkout: { plan: Exclude<PlanId, 'free'>; period: Period } | null;
  classOpen: boolean;
  enquiry: 'campus' | 'enterprise' | null;
  set(patch: Partial<Omit<AccountUi, 'set'>>): void;
}

export const useAccountUi = create<AccountUi>((set) => ({
  pricing: false,
  checkout: null,
  classOpen: false,
  enquiry: null,
  set: (patch) => set(patch),
}));
