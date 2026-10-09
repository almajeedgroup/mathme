import { create } from 'zustand';

import { ACCOUNTS_ON, api } from './api';
import { type Limits, PLANS, type PlanId } from './plans';

export interface Me {
  user: { id: string; email: string; name: string; avatar: string; role: 'user' | 'owner' } | null;
  signinAvailable: boolean;
  plan: PlanId;
  source: 'free' | 'subscription' | 'campus';
  limits: Limits;
  usage?: { exports: number; geometry: number; ai: number; cloudProjects: number };
  subscription?: {
    plan: PlanId;
    period: 'monthly' | 'annual';
    status: string;
    currentPeriodEnd: number;
    cancelAtPeriodEnd: boolean;
  } | null;
  campus?: {
    orgId: string;
    name: string;
    role: 'teacher' | 'student';
    active: boolean;
    endsAt: number;
    plan: PlanId;
  } | null;
}

/** Without accounts (local use, self-hosting, the demo) everything is unlocked. */
const LOCAL: Me = {
  user: null,
  signinAvailable: false,
  plan: 'pro',
  source: 'free',
  limits: { ...PLANS.pro.limits, cloudProjects: 0 },
};

interface AccountState {
  me: Me;
  /** true once /api/me has answered (or immediately without accounts) */
  ready: boolean;
  refresh(): Promise<Me>;
  signIn(returnTo?: string): void;
  signOut(): Promise<void>;
}

export const useAccount = create<AccountState>()((set, get) => ({
  me: ACCOUNTS_ON ? { ...LOCAL, plan: 'free', limits: PLANS.free.limits, signinAvailable: true } : LOCAL,
  ready: !ACCOUNTS_ON,
  refresh: async () => {
    if (!ACCOUNTS_ON) return LOCAL;
    try {
      const me = await api<Me>('/api/me');
      set({ me, ready: true });
      return me;
    } catch {
      set({ ready: true });
      return get().me;
    }
  },
  signIn: (returnTo) => {
    const ret = returnTo ?? `${location.pathname}${location.hash}`;
    location.href = `/api/auth/google/start?ret=${encodeURIComponent(ret)}`;
  },
  signOut: async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    location.reload();
  },
}));

export const signedIn = () => Boolean(useAccount.getState().me.user);
