import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_SAFETY_CAPS, effectiveAccountLimits, resolveCaps, type AccountLimit, type SafetyCaps } from "@/lib/account-safety";

type Ctx = { supabase: any; userId: string };
const orgInput = z.object({ organizationId: z.string().uuid() });

/** Per-account safety limits, caps and usage (this hour / today / this month) for a workspace. */
export const getAccountSafety = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: member } = await (context as Ctx).supabase.rpc("current_user_is_org_member", { _org_id: data.organizationId });
    if (member !== true) throw new Error("Forbidden");
    const { supabaseAdmin: a } = await import("@/integrations/supabase/client.server");
    const { monthStartIso } = await import("@/lib/plan-limits.server");
    const org = data.organizationId;
    const now = Date.now();
    const dayAgo = new Date(now - 86_400_000).toISOString();
    const hourAgo = new Date(now - 3_600_000).toISOString();
    const [accs, settings, trust, ps, runs] = await Promise.all([
      a.from("social_accounts").select("id, platform, name, handle").eq("organization_id", org).order("created_at"),
      a.from("automation_settings").select("hourly_send_limit, daily_send_limit, per_contact_daily_limit").eq("organization_id", org).maybeSingle(),
      a.from("trust_settings").select("account_limits").eq("organization_id", org).maybeSingle(),
      a.from("platform_settings").select("feature_flags").eq("id", true).maybeSingle(),
      a.from("automation_runs").select("run_key, id, created_at, conversations(social_account_id)").eq("organization_id", org).eq("status", "sent").gte("created_at", monthStartIso()).limit(20000),
    ]);
    const ws = {
      hourly: settings.data?.hourly_send_limit ?? 60,
      daily: settings.data?.daily_send_limit ?? 500,
      perContact: settings.data?.per_contact_daily_limit ?? 3,
    };
    const caps = resolveCaps((ps.data?.feature_flags ?? {}) as Record<string, unknown>, org);
    const overrides = ((trust.data as { account_limits?: Record<string, AccountLimit> } | null)?.account_limits ?? {}) as Record<string, AccountLimit>;
    const rows = (runs.data ?? []) as unknown as { run_key: string | null; id: string; created_at: string; conversations: { social_account_id: string | null } | null }[];
    const stats = new Map<string, { month: Set<string>; day: number; hour: number }>();
    for (const r of rows) {
      const id = r.conversations?.social_account_id ?? "none";
      const s = stats.get(id) ?? { month: new Set<string>(), day: 0, hour: 0 };
      s.month.add(r.run_key ?? r.id);
      if (r.created_at >= dayAgo) s.day++;
      if (r.created_at >= hourAgo) s.hour++;
      stats.set(id, s);
    }
    return {
      workspace: ws,
      caps,
      accounts: (accs.data ?? []).map((acc) => {
        const s = stats.get(acc.id);
        return {
          ...acc,
          override: overrides[acc.id] ?? null,
          limits: effectiveAccountLimits(ws, overrides[acc.id], caps),
          runsThisMonth: s?.month.size ?? 0,
          sentToday: s?.day ?? 0,
          sentThisHour: s?.hour ?? 0,
        };
      }),
    };
  });

const limitSchema = z.object({
  hourly: z.number().int().min(1).max(10_000).nullable(),
  daily: z.number().int().min(1).max(100_000).nullable(),
  perContact: z.number().int().min(1).max(100).nullable(),
});

/** Owner/admin/manager: set (or clear) one account's override. Values are clamped to the caps. */
export const saveAccountSafety = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgInput.extend({ socialAccountId: z.string().uuid(), override: limitSchema.nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = (context as Ctx).supabase;
    const { data: ok } = await sb.rpc("current_user_has_org_role", { _org_id: data.organizationId, _roles: ["owner", "admin", "manager"] });
    if (ok !== true) throw new Error("Only owners, admins and managers can change safety limits.");
    const { supabaseAdmin: a } = await import("@/integrations/supabase/client.server");
    const { data: acc } = await a.from("social_accounts").select("id").eq("id", data.socialAccountId).eq("organization_id", data.organizationId).maybeSingle();
    if (!acc) throw new Error("Account not found in this workspace.");
    const [{ data: ps }, { data: ts }] = await Promise.all([
      a.from("platform_settings").select("feature_flags").eq("id", true).maybeSingle(),
      a.from("trust_settings").select("account_limits").eq("organization_id", data.organizationId).maybeSingle(),
    ]);
    const caps = resolveCaps((ps?.feature_flags ?? {}) as Record<string, unknown>, data.organizationId);
    const map = { ...(((ts as { account_limits?: Record<string, AccountLimit> } | null)?.account_limits ?? {}) as Record<string, AccountLimit>) };
    if (data.override) {
      const o = data.override;
      map[data.socialAccountId] = {
        hourly: o.hourly === null ? null : Math.min(o.hourly, caps.hourly),
        daily: o.daily === null ? null : Math.min(o.daily, caps.daily),
        perContact: o.perContact === null ? null : Math.min(o.perContact, caps.perContact),
      };
    } else delete map[data.socialAccountId];
    const { error } = await a.from("trust_settings").upsert(
      { organization_id: data.organizationId, account_limits: map, updated_at: new Date().toISOString() } as never,
      { onConflict: "organization_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function assertSuper(context: Ctx) {
  const { data } = await context.supabase.rpc("current_user_has_platform_role", { _role: "super_admin" });
  if (data !== true) throw new Error("Forbidden");
}
const capsKey = (orgId: string | null) => (orgId ? `safety_caps_${orgId}` : "safety_caps");

/** Super admin: global (orgId null) or per-workspace max values. */
export const getSafetyCaps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: z.string().uuid().nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuper(context as Ctx);
    const { supabaseAdmin: a } = await import("@/integrations/supabase/client.server");
    const { data: ps } = await a.from("platform_settings").select("feature_flags").eq("id", true).maybeSingle();
    const flags = (ps?.feature_flags ?? {}) as Record<string, unknown>;
    return {
      own: (flags[capsKey(data.organizationId)] ?? null) as Partial<SafetyCaps> | null,
      effective: data.organizationId ? resolveCaps(flags, data.organizationId) : resolveCaps({ safety_caps: flags["safety_caps"] }, "-"),
      defaults: DEFAULT_SAFETY_CAPS,
    };
  });

export const saveSafetyCaps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      organizationId: z.string().uuid().nullable(),
      caps: z.object({ hourly: z.number().int().min(1).max(200), daily: z.number().int().min(1).max(100_000), perContact: z.number().int().min(1).max(100) }).nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuper(context as Ctx);
    const { supabaseAdmin: a } = await import("@/integrations/supabase/client.server");
    const { data: ps } = await a.from("platform_settings").select("feature_flags").eq("id", true).maybeSingle();
    const flags = { ...((ps?.feature_flags ?? {}) as Record<string, unknown>) };
    const key = capsKey(data.organizationId);
    if (data.caps) flags[key] = data.caps;
    else delete flags[key];
    const { error } = await a.from("platform_settings").upsert({ id: true, feature_flags: flags, updated_at: new Date().toISOString() } as never, { onConflict: "id" });
    if (error) throw new Error(error.message);
    await a.from("platform_audit_log").insert({
      actor_user_id: (context as Ctx).userId,
      action: "safety_caps.update",
      target_type: data.organizationId ? "organization" : "platform",
      target_id: data.organizationId ?? "global",
      detail: { caps: data.caps },
    });
    return { ok: true };
  });
