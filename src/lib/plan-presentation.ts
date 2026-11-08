import { formatPaise, type PlanDef, type PlanOption } from "@/lib/plans";

export function optionPrice(option: PlanOption): string {
  const duration = option.months === null ? "3-day trial" : option.months === 1 ? "month" : `${option.months} months`;
  return `${formatPaise(option.amountPaise)} / ${duration}`;
}

export function planPrice(plan: PlanDef): string {
  if (plan.contactOnly) return plan.headline || "Contact for pricing";
  return plan.options[0] ? optionPrice(plan.options[0]) : "No payment option";
}

export function configuredPlanOption(plans: PlanDef[], key: string, cycle: string): PlanOption | null {
  const plan = plans.find((item) => item.key === key);
  if (!plan || plan.contactOnly) return null;
  return plan.options.find((option) => option.cycle === cycle) ?? null;
}

export const PLAN_DEPENDENT_QUERIES = ["platform-config", "public-plans", "plan-usage", "billing-state", "organizations", "workspace-features", "platform-overview", "account-safety"] as const;