import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const safetyLockFlag = (orgId: string) => `safety_locked_${orgId}`;

type Ctx = { supabase: any; userId: string };

async function assertSuper(context: Ctx) {
  const { data } = await context.supabase.rpc("current_user_has_platform_role", {
    _role: "super_admin",
  });
  if (data !== true) throw new Error("Forbidden");
}

const SETTINGS_SELECT =
  "is_paused, blocked_keywords, opt_out_keywords, per_contact_daily_limit, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, timezone_offset_minutes, hourly_send_limit, daily_send_limit, viral_guard_enabled, viral_threshold_per_minute, viral_cooldown_minutes";

export const getOrgSafety = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuper(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: row }, { data: ps }] = await Promise.all([
      supabaseAdmin
        .from("automation_settings")
        .select(SETTINGS_SELECT)
        .eq("organization_id", data.organizationId)
        .maybeSingle(),
      supabaseAdmin.from("platform_settings").select("feature_flags").eq("id", true).maybeSingle(),
    ]);
    const flags = (ps?.feature_flags as Record<string, unknown> | null) ?? {};
    return {
      settings: {
        is_paused: false,
        per_contact_daily_limit: 3,
        hourly_send_limit: 60,
        daily_send_limit: 500,
        quiet_hours_enabled: false,
        viral_guard_enabled: true,
        viral_threshold_per_minute: 20,
        viral_cooldown_minutes: 15,
        ...(row ?? {}),
      },
      locked: flags[safetyLockFlag(data.organizationId)] === true,
    };
  });

export const saveOrgSafety = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        locked: z.boolean(),
        isPaused: z.boolean(),
        perContactDailyLimit: z.number().int().min(1).max(100),
        hourlySendLimit: z.number().int().min(1).max(10000),
        dailySendLimit: z.number().int().min(1).max(100000),
        quietHoursEnabled: z.boolean(),
        viralGuardEnabled: z.boolean(),
        viralThresholdPerMinute: z.number().int().min(5).max(1000),
        viralCooldownMinutes: z.number().int().min(1).max(720),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuper(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("automation_settings").upsert(
      {
        organization_id: data.organizationId,
        is_paused: data.isPaused,
        per_contact_daily_limit: data.perContactDailyLimit,
        hourly_send_limit: data.hourlySendLimit,
        daily_send_limit: data.dailySendLimit,
        quiet_hours_enabled: data.quietHoursEnabled,
        viral_guard_enabled: data.viralGuardEnabled,
        viral_threshold_per_minute: data.viralThresholdPerMinute,
        viral_cooldown_minutes: data.viralCooldownMinutes,
      },
      { onConflict: "organization_id" },
    );
    if (error) throw new Error(error.message);
    const { data: ps } = await supabaseAdmin
      .from("platform_settings")
      .select("feature_flags")
      .eq("id", true)
      .maybeSingle();
    const flags = { ...((ps?.feature_flags as Record<string, unknown> | null) ?? {}) };
    flags[safetyLockFlag(data.organizationId)] = data.locked;
    await supabaseAdmin.from("platform_settings").update({ feature_flags: flags as never }).eq("id", true);
    await supabaseAdmin.from("platform_audit_log").insert({
      actor_user_id: context.userId,
      action: "organization.safety_updated",
      target_type: "organization",
      target_id: data.organizationId,
      detail: { locked: data.locked } as never,
    });
    return { ok: true };
  });

/** Used by the workspace side: is the safety section locked by the super admin? */
export async function isSafetyLocked(orgId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("platform_settings")
    .select("feature_flags")
    .eq("id", true)
    .maybeSingle();
  return ((data?.feature_flags as Record<string, unknown> | null) ?? {})[safetyLockFlag(orgId)] === true;
}
