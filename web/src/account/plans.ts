import catalogue from '../../../shared/plans.json';

/** Plans and limits, from the repository's shared/plans.json (the account service reads the same file). */
export type PlanId = 'free' | 'plus' | 'pro';
export type Period = 'monthly' | 'annual';
export type ExportFormat = keyof typeof catalogue.exportFormats;

export interface Limits {
  cloudProjects: number;
  projectBytes: number;
  maxObjects: number;
  patterns: string[] | 'all';
  exportsPerMonth: number;
  exportFormats: string[];
  twoDToThreeD: boolean;
  myShapes: number;
  geometryJobsPerDay: number;
  aiMessagesPerDay: number;
  priority: boolean;
  commercialUse: boolean;
}

export interface PlanInfo {
  label: string;
  name: string;
  tagline: string;
  prices: Partial<Record<Period, number>>;
  limits: Limits;
  features: string[];
}

export const UNLIMITED = catalogue.unlimited;
export const GST_RATE = catalogue.gstRate;
export const EXPORT_LABELS: Record<string, string> = catalogue.exportFormats;

export const PLANS = catalogue.plans as unknown as Record<PlanId, PlanInfo> & {
  campus: Omit<PlanInfo, 'limits'> & { seats: { students: number; teachers: number } };
};

/** ₹ from paise, Indian digit grouping: 1499900 → "₹14,999". */
export function inr(paise: number, withPaise = false): string {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString('en-IN', {
    minimumFractionDigits: withPaise ? 2 : 0,
    maximumFractionDigits: withPaise ? 2 : 0,
  })}`;
}

/** GST added on top, as the account service computes it (18%, rounded half up to the paisa). */
export function withGst(base: number, sellerState: string, buyerState: string) {
  const tax = Math.floor((base * 18 + 50) / 100);
  if (sellerState.trim().toLowerCase() === buyerState.trim().toLowerCase()) {
    const cgst = Math.floor(tax / 2);
    return { base, cgst, sgst: tax - cgst, igst: 0, total: base + tax };
  }
  return { base, cgst: 0, sgst: 0, igst: tax, total: base + tax };
}
