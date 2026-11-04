import { readPlatformConfig } from "@/lib/platform-config.server";
import { DEFAULT_PLAN_LIMITS, type PlanLimits } from "@/lib/plans";
import { resolveWorkspaceEntitlements } from "./workspace-entitlements.server";

type AdminClient = import("@supabase/supabase-js").SupabaseClient;

export const overrideKey = (orgId: string) => `plan_limits_${orgId}`;

export type ResolvedLimits = PlanLimits & { plan: string; overridden: boolean };

/** Effective plan limits for a workspace: super-admin override > plan catalogue > defaults. null = unlimited. */
export async function resolveOrgLimits(admin: AdminClient, orgId: string): Promise<ResolvedLimits> {
  const [{ data: org }, config, { data: ps }] = await Promise.all([
    admin.from("organizations").select("plan, plan_expires_at, plan_source, parent_organization_id, created_at").eq("id", orgId).maybeSingle(),
    readPlatformConfig(admin),
    admin.from("platform_settings").select("feature_flags").eq("id", true).maybeSingle(),
  ]);
  const entitlement = await resolveWorkspaceEntitlements(admin, org ?? { plan: "starter" });
  const plan = entitlement.plan;
  const expires = entitlement.plan_expires_at;
  // Expired free trial: no new automated flows (mid-flow contacts are still finished by the caller).
  const { isTrialExpired } = await import("@/lib/trial");
  const trialOver = isTrialExpired(plan, plan === "starter" ? expires : null, org?.created_at as string | undefined);
  const base =
    config.plans.find((p) => p.key === plan)?.limits ??
    DEFAULT_PLAN_LIMITS[plan as keyof typeof DEFAULT_PLAN_LIMITS] ??
    DEFAULT_PLAN_LIMITS.starter;
  const flags = (ps?.feature_flags ?? {}) as Record<string, unknown>;
  const ov = flags[overrideKey(orgId)] as Partial<PlanLimits> | undefined;
  if (trialOver && !(ov && typeof ov === "object")) {
    return { plan, overridden: false, monthlyDms: 0, maxRules: 0 };
  }
  if (ov && typeof ov === "object") {
    return {
      plan,
      overridden: true,
      monthlyDms: "monthlyDms" in ov ? (ov.monthlyDms ?? null) : base.monthlyDms,
      maxRules: "maxRules" in ov ? (ov.maxRules ?? null) : base.maxRules,
    };
  }
  return { plan, overridden: false, ...base };
}

export function monthStartIso(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** Plan usage: one automation run = 1, however many steps/DMs it sent (rows grouped by run_key). */
export async function countMonthlySent(admin: AdminClient, orgId: string) {
  const { data, error } = await admin.rpc("count_org_runs" as never, { _org_id: orgId, _since: monthStartIso() } as never);
  if (!error && typeof data === "number") return data;
  const { count } = await admin
    .from("automation_runs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("status", "sent")
    .gte("created_at", monthStartIso());
  return count ?? 0;
}

export async function countActiveRules(admin: AdminClient, orgId: string, excludeId?: string) {
  let q = admin
    .from("automation_rules")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("is_active", true);
  if (excludeId) q = q.neq("id", excludeId);
  const { count } = await q;
  return count ?? 0;
}

/** Throws a friendly error when switching on one more rule would exceed the plan. */
export async function assertRuleSlot(admin: AdminClient, orgId: string, excludeId?: string) {
  const limits = await resolveOrgLimits(admin, orgId);
  if (limits.maxRules === null) return;
  const active = await countActiveRules(admin, orgId, excludeId);
  if (active >= limits.maxRules) {
    throw new Error(
      `Rule limit reached: your plan allows ${limits.maxRules} active rules. Switch one off or upgrade your plan.`,
    );
  }
}
