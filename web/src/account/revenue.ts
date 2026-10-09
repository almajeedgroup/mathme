import { PLANS } from './plans';

export interface Scenario {
  plus: number;
  pro: number;
  campus: number;
  enterprise: number;
  /** assumed Enterprise price per month, in paise */
  enterpriseMonthly: number;
}

/** The business plan's example: 100 Plus, 25 Pro, 5 Campus, 1 Enterprise at ₹30,000 a month. */
export const SCENARIO_START: Scenario = {
  plus: 100,
  pro: 25,
  campus: 5,
  enterprise: 1,
  enterpriseMonthly: 3_000_000,
};

/** Monthly revenue equivalent and annual run rate, in paise. Planning assumptions, not a forecast. */
export function revenueScenario(n: Scenario) {
  const monthly =
    n.plus * (PLANS.plus.prices.monthly ?? 0) +
    n.pro * (PLANS.pro.prices.monthly ?? 0) +
    (n.campus * (PLANS.campus.prices.annual ?? 0)) / 12 +
    n.enterprise * n.enterpriseMonthly;
  return { monthly: Math.round(monthly), annual: Math.round(monthly * 12) };
}
