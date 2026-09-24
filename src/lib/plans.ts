export type PlanKey = "starter" | "pro" | "agency";
export type BillingCycle = "lifetime" | "monthly" | "half_yearly" | "yearly";

export type PlanOption = {
  cycle: BillingCycle;
  label: string;
  amountPaise: number;
  months: number | null; // null = 3-day trial
};

export type PlanDef = {
  key: PlanKey;
  name: string;
  headline: string;
  perks: string[];
  options: PlanOption[];
  contactOnly?: boolean;
};

export const PLANS: PlanDef[] = [
  {
    key: "starter",
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
