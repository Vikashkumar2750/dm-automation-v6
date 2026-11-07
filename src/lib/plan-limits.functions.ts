import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

async function assertSuper(context: Ctx) {
  const { data } = await context.supabase.rpc("current_user_has_platform_role", { _role: "super_admin" });
  if (data !== true) throw new Error("Forbidden");
}

/** Workspace member: current plan limits and usage this month. */
export const getPlanUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: member } = await (context as Ctx).supabase.rpc("current_user_is_org_member", {
      _org_id: data.organizationId,
    });
    if (member !== true) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const m = await import("@/lib/plan-limits.server");
    const [limits, dmsThisMonth, activeRules] = await Promise.all([
      m.resolveOrgLimits(supabaseAdmin, data.organizationId, { strictReads: true }),
      m.readMonthlyRunUsage(supabaseAdmin, data.organizationId),
      m.countActiveRules(supabaseAdmin, data.organizationId, undefined, { strictReads: true }),
    ]);
    return { ...limits, dmsThisMonth, activeRules };
  });

/** Super admin: read the per-workspace override (null = follow plan). */
export const getOrgLimitOverride = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuper(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { overrideKey } = await import("@/lib/plan-limits.server");
    const { data: ps } = await supabaseAdmin.from("platform_settings").select("feature_flags").eq("id", true).maybeSingle();
    const flags = (ps?.feature_flags ?? {}) as Record<string, unknown>;
    return (flags[overrideKey(data.organizationId)] ?? null) as
      | { monthlyDms: number | null; maxRules: number | null }
      | null;
  });

export const saveOrgLimitOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        override: z
          .object({
            monthlyDms: z.number().int().min(0).max(10_000_000).nullable(),
            maxRules: z.number().int().min(0).max(10_000).nullable(),
          })
          .nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuper(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { overrideKey } = await import("@/lib/plan-limits.server");
    const { data: ps } = await supabaseAdmin.from("platform_settings").select("feature_flags").eq("id", true).maybeSingle();
    const flags = { ...((ps?.feature_flags ?? {}) as Record<string, unknown>) };
    if (data.override) flags[overrideKey(data.organizationId)] = data.override;
    else delete flags[overrideKey(data.organizationId)];
    const { error } = await supabaseAdmin
      .from("platform_settings")
      .upsert({ id: true, feature_flags: flags, updated_at: new Date().toISOString() } as never, { onConflict: "id" });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("platform_audit_log").insert({
      actor_user_id: (context as Ctx).userId,
      action: "org.plan_limits_override",
      target_type: "organization",
      target_id: data.organizationId,
      detail: { override: data.override },
    });
    return { ok: true };
  });
