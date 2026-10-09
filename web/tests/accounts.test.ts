import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { inr, PLANS, withGst } from '../src/account/plans';
import { revenueScenario, SCENARIO_START } from '../src/account/revenue';

describe('plans', () => {
  it('has the launch prices before GST', () => {
    expect(PLANS.plus.prices).toEqual({ monthly: 29_900, annual: 249_900 });
    expect(PLANS.pro.prices).toEqual({ monthly: 79_900, annual: 699_900 });
    expect(PLANS.campus.prices.annual).toBe(1_499_900);
    expect(PLANS.campus.seats).toEqual({ students: 100, teachers: 5 });
    expect(PLANS.free.limits.cloudProjects).toBe(3);
    expect(PLANS.free.limits.patterns).toEqual(['spiral', 'grid', 'circle']);
  });

  it('adds GST like the account service', () => {
    expect(withGst(29_900, 'Karnataka', 'Kerala')).toEqual({
      base: 29_900,
      cgst: 0,
      sgst: 0,
      igst: 5_382,
      total: 35_282,
    });
    expect(withGst(29_900, 'Karnataka', 'Karnataka')).toMatchObject({
      cgst: 2_691,
      sgst: 2_691,
      total: 35_282,
    });
    expect(withGst(1_499_900, 'Goa', 'Delhi').total).toBe(1_769_882);
  });

  it('writes rupees the Indian way', () => {
    expect(inr(1_499_900)).toBe('₹14,999');
    expect(inr(103_349_500)).toBe('₹10,33,495');
    expect(inr(35_282, true)).toBe('₹352.82');
  });

  it('keeps the landing page prices in step with plans.json', () => {
    const html = readFileSync(resolve(__dirname, '../landing/index.html'), 'utf8');
    for (const [id, price] of [
      ['plus', PLANS.plus.prices.monthly],
      ['pro', PLANS.pro.prices.monthly],
      ['campus', PLANS.campus.prices.annual],
    ] as const) {
      expect(html, `landing price for ${id}`).toContain(`data-price="${id}">${inr(price ?? 0)}<`);
    }
  });
});

describe('revenue scenario', () => {
  it('reproduces the business plan example', () => {
    const r = revenueScenario(SCENARIO_START);
    expect(inr(r.monthly)).toBe('₹86,125');
    expect(inr(r.annual)).toBe('₹10,33,495');
    expect(revenueScenario({ plus: 0, pro: 0, campus: 0, enterprise: 0, enterpriseMonthly: 0 }).monthly).toBe(
      0,
    );
  });
});

describe('limits', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('unlocks everything without accounts', async () => {
    const { can } = await import('../src/account/limits');
    expect(can({ kind: 'export', format: 'stl' })).toBe(true);
    expect(can({ kind: 'objects', count: 19_000 })).toBe(true);
  });

  it('follows the plan with accounts on', async () => {
    vi.stubEnv('VITE_ACCOUNTS', 'on');
    const { can, gate, useUpgradePrompt } = await import('../src/account/limits');
    const { useAccount } = await import('../src/account/accountStore');
    expect(useAccount.getState().me.plan).toBe('free');
    expect(can({ kind: 'pattern', type: 'spiral' })).toBe(true);
    expect(can({ kind: 'pattern', type: 'wave' })).toBe(false);
    expect(can({ kind: 'objects', count: 2_000 })).toBe(true);
    expect(can({ kind: 'objects', count: 2_001 })).toBe(false);
    expect(can({ kind: 'twoDToThreeD' })).toBe(false);
    expect(can({ kind: 'myShapes', count: 2 })).toBe(false);
    expect(gate({ kind: 'export', format: 'stl' })).toBe(false);
    expect(useUpgradePrompt.getState()).toMatchObject({ open: true, plan: 'plus' });
    expect(gate({ kind: 'export', format: 'png-4k' })).toBe(false);
    expect(useUpgradePrompt.getState().plan).toBe('pro');
    useAccount.setState({ me: { ...useAccount.getState().me, plan: 'plus' } });
    expect(can({ kind: 'export', format: 'stl' })).toBe(true);
    expect(can({ kind: 'twoDToThreeD' })).toBe(true);
  });
});
