export type PlanKey = "starter" | "pro" | "agency";
export type BillingCycle = "lifetime" | "monthly" | "half_yearly" | "yearly";

export type PlanOption = {
  cycle: BillingCycle;
  label: string;
  amountPaise: number;
  months: number | null; // null = 3-day trial
};

/** null = unlimited */
export type PlanLimits = { monthlyDms: number | null; maxRules: number | null };

export const DEFAULT_PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  starter: { monthlyDms: 300, maxRules: 3 },
  pro: { monthlyDms: 10000, maxRules: 50 },
  agency: { monthlyDms: null, maxRules: null },
};

export type PlanDef = {
  key: PlanKey;
  name: string;
  headline: string;
  perks: string[];
  options: PlanOption[];
  contactOnly?: boolean;
  limits?: PlanLimits;
};

export const PLANS: PlanDef[] = [
  {
    key: "starter",
    limits: DEFAULT_PLAN_LIMITS.starter,
    name: "Free",
    headline: "₹9 · 3-day trial",
    perks: [
      "1 Instagram account, 1 Facebook page, 1 YouTube channel",
      "DM & comment automation",
      "AI content analysis",
    ],
    options: [{ cycle: "lifetime", label: "₹9 for 3 days trial", amountPaise: 900, months: null }],
  },
  {
    key: "pro",
    limits: DEFAULT_PLAN_LIMITS.pro,
    name: "Pro",
    headline: "₹59 / month",
    perks: [
      "5 Instagram accounts, 5 Facebook pages, 5 YouTube channels",
      "Publish to all accounts at once",
      "AI content analysis + priority support",
    ],
    options: [
      { cycle: "monthly", label: "₹59 / month", amountPaise: 5900, months: 1 },
      { cycle: "half_yearly", label: "₹299 / 6 months", amountPaise: 29900, months: 6 },
      { cycle: "yearly", label: "₹599 / year", amountPaise: 59900, months: 12 },
    ],
  },
  {
    key: "agency",
    limits: DEFAULT_PLAN_LIMITS.agency,
    name: "Agency",
    headline: "Custom pricing",
    perks: ["Unlimited accounts & client workspaces", "White-label branding", "Dedicated support"],
    options: [],
    contactOnly: true,
  },
];

export function findPlanOption(plan: PlanKey, cycle: BillingCycle): PlanOption | null {
  return PLANS.find((p) => p.key === plan)?.options.find((o) => o.cycle === cycle) ?? null;
}

export function formatPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

export type PlanButtonState = "buy" | "renew" | "active" | "locked";

/**
 * Billing card state. While a plan is active the other plans are locked;
 * from 7 days before expiry the current plan shows Renew; after expiry all plans are buyable.
 * A Starter workspace with no end date is treated as "no active plan".
 */
export function planButtonState(
  cardPlan: PlanKey,
  currentPlan: string,
  expiresAt: string | null,
  now: number = Date.now(),
): PlanButtonState {
  const isCurrent = cardPlan === currentPlan;
  if (!expiresAt) {
    if (currentPlan === "starter") return isCurrent ? "renew" : "buy";
    return isCurrent ? "active" : "locked";
  }
  const msLeft = new Date(expiresAt).getTime() - now;
  if (msLeft <= 0) return isCurrent ? "renew" : "buy";
  if (msLeft <= 7 * 864e5) return isCurrent ? "renew" : "locked";
  return isCurrent ? "active" : "locked";
}
