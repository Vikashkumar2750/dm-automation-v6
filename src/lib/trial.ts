/** Free trial rules shared by server limits and the in-app banner. */
export const TRIAL_DAYS = 3;
// Workspaces created before trial enforcement get a short grace period instead of expiring at once.
export const TRIAL_ENFORCED_FROM = "2026-10-02T00:00:00Z";

export function trialEndsAt(plan: string, expiresAt: string | null | undefined, createdAt: string | null | undefined): Date | null {
  if (plan.toLowerCase() !== "starter") return null;
  if (expiresAt) return new Date(expiresAt);
  const start = Math.max(new Date(createdAt ?? Date.now()).getTime(), new Date(TRIAL_ENFORCED_FROM).getTime());
  return new Date(start + TRIAL_DAYS * 864e5);
}

export function isTrialExpired(plan: string, expiresAt: string | null | undefined, createdAt: string | null | undefined, now = new Date()) {
  const end = trialEndsAt(plan, expiresAt, createdAt);
  return !!end && end < now;
}
