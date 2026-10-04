import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkPolicy, computeHealthScore, isRateLimitError, predictRateRisk } from "./trust-safety";

const orgInput = z.object({ organizationId: z.string().uuid() });

/** Health score per account, rate guard forecast, policy scan of all rules, settings. */
export const getTrustOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const org = data.organizationId;
    const t = Date.now();
    const iso = (ms: number) => new Date(t - ms).toISOString();
    const [accounts, runs, events, convs, settings, trust, rules, sentHour, sent10m] = await Promise.all([
      sb.from("social_accounts").select("id, platform, name, handle, status, token_expires_at").eq("organization_id", org),
      sb.from("automation_runs").select("status, detail, created_at, conversations(social_account_id)").eq("organization_id", org).in("status", ["sent", "failed"]).gte("created_at", iso(7 * 86_400_000)).limit(5000),
      sb.from("webhook_events").select("social_account_id, status, received_at").eq("organization_id", org).gte("received_at", iso(30 * 86_400_000)).order("received_at", { ascending: false }).limit(2000),
      sb.from("conversations").select("id").eq("organization_id", org).limit(1),
      sb.from("automation_settings").select("hourly_send_limit, daily_send_limit, auto_paused_until, auto_pause_reason, is_paused").eq("organization_id", org).maybeSingle(),
      sb.from("trust_settings").select("predictive_guard, last_guard_action_at").eq("organization_id", org).maybeSingle(),
      sb.from("automation_rules").select("id, name, is_active, response_text, response_variations, comment_reply_text, comment_reply_variations, follow_prompt_text").eq("organization_id", org).limit(200),
      sb.from("automation_runs").select("id", { count: "exact", head: true }).eq("organization_id", org).eq("status", "sent").gte("created_at", iso(3_600_000)),
      sb.from("automation_runs").select("id", { count: "exact", head: true }).eq("organization_id", org).eq("status", "sent").gte("created_at", iso(600_000)),
    ]);
    void convs;
    const runRows = (runs.data ?? []) as { status: string; detail: string | null; created_at: string; conversations: { social_account_id: string | null } | null }[];
    const evRows = (events.data ?? []) as { social_account_id: string | null; status: string; received_at: string }[];
    const day = t - 86_400_000;
    const q15 = t - 15 * 60_000;

    const health = (accounts.data ?? []).map((a: any) => {
      const mine = runRows.filter((r) => r.conversations?.social_account_id === a.id);
      const ev = evRows.filter((e) => e.social_account_id === a.id);
      const result = computeHealthScore({
        status: a.status,
        platform: a.platform,
        tokenExpiresAt: a.token_expires_at,
        sent7d: mine.filter((r) => r.status === "sent").length,
        failed7d: mine.filter((r) => r.status === "failed").length,
        rateLimitErrors24h: mine.filter((r) => r.status === "failed" && Date.parse(r.created_at) > day && isRateLimitError(r.detail)).length,
        webhookErrors24h: ev.filter((e) => e.status === "failed" && Date.parse(e.received_at) > day).length,
        lastEventAt: ev[0]?.received_at ?? null,
        now: t,
      });
      return { id: a.id, platform: a.platform, name: a.name ?? a.handle ?? "Account", handle: a.handle, ...result };
    });

    const hourlyLimit = settings.data?.hourly_send_limit ?? 60;
    const rate = predictRateRisk({
      sentLast10m: sent10m.count ?? 0,
      sentLastHour: sentHour.count ?? 0,
      hourlyLimit,
      rateLimitErrors15m: runRows.filter((r) => r.status === "failed" && Date.parse(r.created_at) > q15 && isRateLimitError(r.detail)).length,
    });

    const policy = (rules.data ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      isActive: r.is_active,
      issues: checkPolicy([r.response_text, ...(r.response_variations ?? []), r.comment_reply_text, ...(r.comment_reply_variations ?? []), r.follow_prompt_text]),
    }));

    return {
      health,
      rate: { ...rate, hourlyLimit, dailyLimit: settings.data?.daily_send_limit ?? 500, sentLastHour: sentHour.count ?? 0 },
      pausedUntil: settings.data?.auto_paused_until && Date.parse(settings.data.auto_paused_until) > t ? settings.data.auto_paused_until : null,
      pauseReason: settings.data?.auto_pause_reason ?? null,
      predictiveGuard: trust.data?.predictive_guard ?? true,
      lastGuardActionAt: trust.data?.last_guard_action_at ?? null,
      policy,
    };
  });

export const saveTrustSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: z.string().uuid(), predictiveGuard: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("trust_settings").upsert(
      { organization_id: data.organizationId, predictive_guard: data.predictiveGuard, updated_at: new Date().toISOString() },
      { onConflict: "organization_id" },
    );
    if (error) throw new Error("Only owners, admins and managers can change this.");
    return { ok: true };
  });

/** Workspace audit trail (owners, admins, managers via RLS). */
export const getAuditTrail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgInput.extend({ entity: z.string().max(60).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("org_audit_log")
      .select("id, actor_user_id, action, entity, entity_id, changed_fields, created_at")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.entity) q = q.eq("entity", data.entity);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const ids = [...new Set((rows ?? []).map((r: any) => r.actor_user_id).filter(Boolean))];
    const { data: profiles } = ids.length
      ? await context.supabase.from("profiles").select("id, full_name, email").in("id", ids)
      : { data: [] };
    const names: Record<string, string> = {};
    for (const p of profiles ?? []) names[p.id] = p.full_name || p.email || "Teammate";
    return (rows ?? []).map((r: any) => ({ ...r, actor: r.actor_user_id ? names[r.actor_user_id] ?? "Teammate" : "System" }));
  });
