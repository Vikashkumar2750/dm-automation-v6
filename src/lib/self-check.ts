import type { PlanDef } from "@/lib/plans";

export type CheckStatus = "pass" | "warn" | "fail";
export type CheckResult = { id: string; area: string; label: string; status: CheckStatus; detail: string };

/** Plan catalogue: every paid option must be purchasable, contact-only plans must not be. */
export function checkPlanCatalogue(plans: PlanDef[]): CheckResult {
  const problems: string[] = [];
  for (const p of plans) {
    if (p.contactOnly) continue;
    for (const o of p.options ?? []) {
      if (!Number.isFinite(o.amountPaise) || o.amountPaise < 0) problems.push(`${p.name} ${o.label}: invalid price`);
      if (!Number.isFinite(o.months) || o.months <= 0) problems.push(`${p.name} ${o.label}: invalid duration`);
    }
  }
  const keys = plans.map((p) => p.key);
  if (new Set(keys).size !== keys.length) problems.push("duplicate plan keys");
  return {
    id: "plans",
    area: "Plans & pricing",
    label: "Saved plans are valid for homepage and checkout",
    status: problems.length ? "fail" : plans.length ? "pass" : "warn",
    detail: problems.length ? problems.join("; ") : `${plans.length} plans read from the saved catalogue`,
  };
}

/** Scheduler heartbeats: each job must have run recently without repeated failures. */
export function checkHeartbeats(
  rows: { job: string; last_run_at: string | null; last_status: number | null; consecutive_failures: number | null }[],
  now = Date.now(),
): CheckResult {
  if (!rows.length)
    return { id: "scheduler", area: "Scheduler", label: "Scheduled jobs are running", status: "fail", detail: "No heartbeats recorded" };
  const stale = rows.filter((r) => !r.last_run_at || now - Date.parse(r.last_run_at) > 30 * 60_000).map((r) => r.job);
  const failing = rows.filter((r) => (r.consecutive_failures ?? 0) > 0 || (r.last_status ?? 0) >= 400).map((r) => r.job);
  const status: CheckStatus = failing.length ? "fail" : stale.length ? "warn" : "pass";
  return {
    id: "scheduler",
    area: "Scheduler",
    label: "Scheduled jobs are running",
    status,
    detail: failing.length
      ? `Failing: ${failing.join(", ")}`
      : stale.length
        ? `No run in 30 min: ${stale.join(", ")}`
        : `${rows.length} jobs healthy`,
  };
}
