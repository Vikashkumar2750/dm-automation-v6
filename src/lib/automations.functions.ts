import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AutomationRule = {
  id: string;
  organization_id: string;
  name: string;
  is_active: boolean;
  priority: number;
  platform: "instagram" | "facebook" | "youtube" | null;
  trigger: "dm_received" | "comment_received";
  match_type: "any" | "contains" | "exact" | "starts_with";
  keywords: string[];
  action:
    | "reply_dm"
    | "comment_public_reply"
    | "comment_private_reply"
    | "hide_comment"
    | "set_status";
  response_text: string | null;
  response_variations: string[];
  set_status: "open" | "pending" | "resolved" | null;
  cooldown_seconds: number;
  daily_limit: number;
  created_at: string;
};

export type AutomationRun = {
  id: string;
  rule_id: string | null;
  conversation_id: string | null;
  status: "matched" | "sent" | "skipped" | "failed";
  detail: string | null;
  created_at: string;
};

const SELECT =
  "id, organization_id, name, is_active, priority, platform, trigger, match_type, keywords, action, response_text, response_variations, set_status, cooldown_seconds, daily_limit, created_at";

const ruleInput = z.object({
  name: z.string().trim().min(1).max(80),
  isActive: z.boolean(),
  priority: z.number().int().min(1).max(999),
  platform: z.enum(["instagram", "facebook"]).nullable(),
  trigger: z.enum(["dm_received", "comment_received"]),
  matchType: z.enum(["any", "contains", "exact", "starts_with"]),
  keywords: z.array(z.string().trim().min(1).max(60)).max(20),
  action: z.enum([
    "reply_dm",
    "comment_public_reply",
    "comment_private_reply",
    "hide_comment",
    "set_status",
  ]),
  responseText: z.string().trim().max(1000).nullable(),
  responseVariations: z.array(z.string().trim().min(1).max(1000)).max(10),
  setStatus: z.enum(["open", "pending", "resolved"]).nullable(),
  cooldownSeconds: z.number().int().min(0).max(86400),
  dailyLimit: z.number().int().min(1).max(5000),
});

function toRow(input: z.infer<typeof ruleInput>) {
  return {
    name: input.name,
    is_active: input.isActive,
    priority: input.priority,
    platform: input.platform,
    trigger: input.trigger,
    match_type: input.matchType,
    keywords: input.keywords,
    action: input.action,
    response_text: input.responseText,
    response_variations: input.responseVariations,
    set_status: input.setStatus,
    cooldown_seconds: input.cooldownSeconds,
    daily_limit: input.dailyLimit,
  };
}

export const listAutomationRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ organizationId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("automation_rules")
      .select(SELECT)
      .eq("organization_id", data.organizationId)
      .order("priority", { ascending: true })
      .limit(100);
    if (error) throw new Error(error.message);
    return (rows ?? []) as AutomationRule[];
  });

export const createAutomationRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    ruleInput.extend({ organizationId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { organizationId, ...rest } = data;
    const { error } = await context.supabase.from("automation_rules").insert({
      organization_id: organizationId,
      created_by: context.userId,
      ...toRow(rest),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateAutomationRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    ruleInput.partial().extend({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const patch: Partial<ReturnType<typeof toRow>> = {};
    if (rest.name !== undefined) patch.name = rest.name;
    if (rest.isActive !== undefined) patch.is_active = rest.isActive;
    if (rest.priority !== undefined) patch.priority = rest.priority;
    if (rest.platform !== undefined) patch.platform = rest.platform;
    if (rest.trigger !== undefined) patch.trigger = rest.trigger;
    if (rest.matchType !== undefined) patch.match_type = rest.matchType;
    if (rest.keywords !== undefined) patch.keywords = rest.keywords;
    if (rest.action !== undefined) patch.action = rest.action;
    if (rest.responseText !== undefined) patch.response_text = rest.responseText;
    if (rest.responseVariations !== undefined)
      patch.response_variations = rest.responseVariations;
    if (rest.setStatus !== undefined) patch.set_status = rest.setStatus;
    if (rest.cooldownSeconds !== undefined) patch.cooldown_seconds = rest.cooldownSeconds;
    if (rest.dailyLimit !== undefined) patch.daily_limit = rest.dailyLimit;

    const { error } = await context.supabase
      .from("automation_rules")
      .update(patch)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAutomationRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("automation_rules")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAutomationRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ organizationId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("automation_runs")
      .select("id, rule_id, conversation_id, status, detail, created_at")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) throw new Error(error.message);
    return (rows ?? []) as AutomationRun[];
  });

// ---------------------------------------------------------------- safety

export type AutomationSettings = {
  organization_id: string;
  is_paused: boolean;
  blocked_keywords: string[];
  opt_out_keywords: string[];
  per_contact_daily_limit: number;
  quiet_hours_enabled: boolean;
  quiet_hours_start: number;
  quiet_hours_end: number;
  timezone_offset_minutes: number;
  hourly_send_limit: number;
  daily_send_limit: number;
  viral_guard_enabled: boolean;
  viral_threshold_per_minute: number;
  viral_cooldown_minutes: number;
  auto_paused_until: string | null;
  auto_pause_reason: string | null;
};

export type AutomationOptOut = {
  id: string;
  platform: "instagram" | "facebook" | "youtube";
  external_user_id: string;
  reason: string | null;
  created_at: string;
};

const SETTINGS_SELECT =
  "organization_id, is_paused, blocked_keywords, opt_out_keywords, per_contact_daily_limit, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, timezone_offset_minutes, hourly_send_limit, daily_send_limit, viral_guard_enabled, viral_threshold_per_minute, viral_cooldown_minutes, auto_paused_until, auto_pause_reason";


export const getAutomationSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ organizationId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("automation_settings")
      .select(SETTINGS_SELECT)
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (row ?? {
      organization_id: data.organizationId,
      is_paused: false,
      blocked_keywords: [],
      opt_out_keywords: ["stop", "unsubscribe", "stop messaging"],
      per_contact_daily_limit: 5,
      quiet_hours_enabled: false,
      quiet_hours_start: 22,
      quiet_hours_end: 7,
      timezone_offset_minutes: 330,
      hourly_send_limit: 120,
      daily_send_limit: 1000,
      viral_guard_enabled: true,
      viral_threshold_per_minute: 30,
      viral_cooldown_minutes: 15,
      auto_paused_until: null,
      auto_pause_reason: null,
    }) as AutomationSettings;
  });

export const saveAutomationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        isPaused: z.boolean(),
        blockedKeywords: z.array(z.string().trim().min(1).max(60)).max(50),
        optOutKeywords: z.array(z.string().trim().min(1).max(60)).max(20),
        perContactDailyLimit: z.number().int().min(1).max(100),
        quietHoursEnabled: z.boolean(),
        quietHoursStart: z.number().int().min(0).max(23),
        quietHoursEnd: z.number().int().min(0).max(23),
        timezoneOffsetMinutes: z.number().int().min(-720).max(840),
        hourlySendLimit: z.number().int().min(1).max(10000),
        dailySendLimit: z.number().int().min(1).max(100000),
        viralGuardEnabled: z.boolean(),
        viralThresholdPerMinute: z.number().int().min(5).max(1000),
        viralCooldownMinutes: z.number().int().min(1).max(720),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("automation_settings").upsert(
      {
        organization_id: data.organizationId,
        is_paused: data.isPaused,
        blocked_keywords: data.blockedKeywords,
        opt_out_keywords: data.optOutKeywords,
        per_contact_daily_limit: data.perContactDailyLimit,
        quiet_hours_enabled: data.quietHoursEnabled,
        quiet_hours_start: data.quietHoursStart,
        quiet_hours_end: data.quietHoursEnd,
        timezone_offset_minutes: data.timezoneOffsetMinutes,
        hourly_send_limit: data.hourlySendLimit,
        daily_send_limit: data.dailySendLimit,
        viral_guard_enabled: data.viralGuardEnabled,
        viral_threshold_per_minute: data.viralThresholdPerMinute,
        viral_cooldown_minutes: data.viralCooldownMinutes,
      },
      { onConflict: "organization_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type AutomationUsage = {
  sentLastHour: number;
  sentLastDay: number;
  skippedLastDay: number;
  failedLastDay: number;
  inboundLastHour: number;
  hourlyLimit: number;
  dailyLimit: number;
  autoPausedUntil: string | null;
  autoPauseReason: string | null;
};

export const getAutomationUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ organizationId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const org = data.organizationId;
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const runCount = (status: string, since: string) =>
      context.supabase
        .from("automation_runs")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org)
        .eq("status", status)
        .gte("created_at", since);

    const [hour, day, skipped, failed, inbound, settings] = await Promise.all([
      runCount("sent", hourAgo),
      runCount("sent", dayAgo),
      runCount("skipped", dayAgo),
      runCount("failed", dayAgo),
      context.supabase
        .from("webhook_events")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org)
        .gte("received_at", hourAgo),
      context.supabase
        .from("automation_settings")
        .select("hourly_send_limit, daily_send_limit, auto_paused_until, auto_pause_reason")
        .eq("organization_id", org)
        .maybeSingle(),
    ]);

    return {
      sentLastHour: hour.count ?? 0,
      sentLastDay: day.count ?? 0,
      skippedLastDay: skipped.count ?? 0,
      failedLastDay: failed.count ?? 0,
      inboundLastHour: inbound.count ?? 0,
      hourlyLimit: settings.data?.hourly_send_limit ?? 120,
      dailyLimit: settings.data?.daily_send_limit ?? 1000,
      autoPausedUntil: settings.data?.auto_paused_until ?? null,
      autoPauseReason: settings.data?.auto_pause_reason ?? null,
    } satisfies AutomationUsage;
  });

export const resumeAutomations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ organizationId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("automation_settings")
      .update({ auto_paused_until: null, auto_pause_reason: null })
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const listOptOuts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ organizationId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("automation_opt_outs")
      .select("id, platform, external_user_id, reason, created_at")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (rows ?? []) as AutomationOptOut[];
  });

export const removeOptOut = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("automation_opt_outs")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
