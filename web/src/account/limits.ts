import { create } from 'zustand';

import { useAccount } from './accountStore';
import { ACCOUNTS_ON, ApiError, api } from './api';
import { EXPORT_LABELS, PLANS, type PlanId, UNLIMITED } from './plans';

/**
 * Plan limits in the app. Server-side features (cloud saves, geometry jobs, AI chat) are enforced by the
 * account service; these checks keep the app honest about the rest and explain what an upgrade unlocks.
 */

export type Feature =
  | { kind: 'pattern'; type: string }
  | { kind: 'objects'; count: number }
  | { kind: 'twoDToThreeD' }
  | { kind: 'myShapes'; count: number }
  | { kind: 'export'; format: string };

interface Prompt {
  open: boolean;
  title: string;
  message: string;
  /** the cheapest plan that unlocks it */
  plan: PlanId | null;
  /** the visitor needs to sign in rather than upgrade */
  signIn: boolean;
}

export const useUpgradePrompt = create<Prompt & { show(p: Omit<Prompt, 'open'>): void; close(): void }>(
  (set) => ({
    open: false,
    title: '',
    message: '',
    plan: null,
    signIn: false,
    show: (p) => set({ ...p, open: true }),
    close: () => set({ open: false }),
  }),
);

function allows(plan: PlanId, f: Feature): boolean {
  const l = PLANS[plan].limits;
  switch (f.kind) {
    case 'pattern':
      return l.patterns === 'all' || l.patterns.includes(f.type);
    case 'objects':
      return f.count <= l.maxObjects;
    case 'twoDToThreeD':
      return l.twoDToThreeD;
    case 'myShapes':
      return l.myShapes === UNLIMITED || f.count < l.myShapes;
    case 'export':
      return l.exportFormats.includes(f.format);
  }
}

export function can(f: Feature): boolean {
  if (!ACCOUNTS_ON) return true;
  return allows(useAccount.getState().me.plan, f);
}

function describe(f: Feature): { title: string; message: string } {
  const plan = PLANS[useAccount.getState().me.plan];
  switch (f.kind) {
    case 'pattern':
      return {
        title: 'More patterns',
        message: `The ${plan.label} plan includes the spiral, grid and circle patterns. The others come with Plus.`,
      };
    case 'objects':
      return {
        title: 'Bigger scenes',
        message: `The ${plan.label} plan allows up to ${plan.limits.maxObjects.toLocaleString('en-IN')} objects in a scene. This would make ${f.count.toLocaleString('en-IN')}.`,
      };
    case 'twoDToThreeD':
      return {
        title: '2D to 3D',
        message: 'Pushing and spinning your sketches into 3D solids is part of Plus.',
      };
    case 'myShapes':
      return {
        title: 'More saved shapes',
        message: `The ${plan.label} plan keeps ${plan.limits.myShapes} of your own shapes.`,
      };
    case 'export':
      return {
        title: `${EXPORT_LABELS[f.format] ?? f.format}`,
        message: `This export is not part of the ${plan.label} plan.`,
      };
  }
}

/** Is it allowed? If not, explain and offer the plan that unlocks it. */
export function gate(f: Feature): boolean {
  if (can(f)) return true;
  const unlock = (['plus', 'pro'] as const).find((p) => allows(p, f)) ?? 'pro';
  useUpgradePrompt.getState().show({ ...describe(f), plan: unlock, signIn: false });
  return false;
}

export function promptSignIn(message: string) {
  useUpgradePrompt.getState().show({ title: 'Sign in to MathMe', message, plan: null, signIn: true });
}

/**
 * Ask the account service before an export: is the format in the plan and is there allowance left this
 * month? Returns false (and explains) if not. Always true without accounts.
 */
export async function exportTicket(format: string): Promise<boolean> {
  if (!ACCOUNTS_ON) return true;
  if (!gate({ kind: 'export', format })) return false;
  if (!useAccount.getState().me.user) {
    promptSignIn('Exports are free: sign in with Google so we can count them (15 a month on the Free plan).');
    return false;
  }
  try {
    await api('/api/usage/export', { method: 'POST', body: { format } });
    void useAccount.getState().refresh();
    return true;
  } catch (e) {
    if (e instanceof ApiError && e.status === 402) {
      const plan = useAccount.getState().me.plan;
      useUpgradePrompt.getState().show({
        title: 'Export limit reached',
        message: e.message,
        plan: plan === 'free' ? 'plus' : 'pro',
        signIn: false,
      });
      return false;
    }
    throw e;
  }
}

/** Turn a 402 from the account service (a used-up quota) into the upgrade prompt. */
export function explainLimit(e: unknown): boolean {
  if (e instanceof ApiError && (e.status === 402 || e.status === 401)) {
    if (e.status === 401) promptSignIn(e.message);
    else {
      const plan = useAccount.getState().me.plan;
      useUpgradePrompt.getState().show({
        title: 'Plan limit reached',
        message: e.message,
        plan: plan === 'free' ? 'plus' : 'pro',
        signIn: false,
      });
    }
    return true;
  }
  return false;
}
