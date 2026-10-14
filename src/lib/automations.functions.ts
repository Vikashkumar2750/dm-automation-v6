import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { activityName, stepLabel, explainReason, webhookEventLabel } from "@/lib/activity-explain";
import { checkPolicy } from "@/lib/trust-safety";

/** Phase H: refuse rule text that clearly breaks Meta messaging policy (warnings are shown in the UI only). */
function assertPolicy(input: object) {
  const t = input as { responseText?: string | null; responseVariations?: string[] | null; commentReplyText?: string | null; commentReplyVariations?: string[] | null; followPromptText?: string | null };
  const b = checkPolicy([t.responseText, ...(t.responseVariations ?? []), t.commentReplyText, ...(t.commentReplyVariations ?? []), t.followPromptText]).find((i) => i.severity === "block");
  if (b) throw new Error(`Policy check: ${b.message}`);
}

export type AutomationRule = {
  id: string;
  organization_id: string;
  name: string;
  is_active: boolean;
  priority: number;
  platform: "instagram" | "facebook" | "youtube" | null;
  trigger: "dm_received" | "comment_received" | "story_reply" | "story_mention";
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
  target_post_ids: string[];
  comment_reply_text: string | null;
  comment_reply_variations: string[];
  dm_link_url: string | null;
  dm_button_label: string | null;
  dm_attachment_url: string | null;
  dm_attachment_type: "none" | "image" | "video" | "file";
  follower_condition: "any" | "followers_only" | "non_followers";
  require_follow: boolean;
  follow_prompt_text: string | null;
};

export type AutomationRun = {
  id: string;
  rule_id: string | null;
  conversation_id: string | null;
  status: "matched" | "sent" | "skipped" | "failed";
  detail: string | null;
  created_at: string;
  run_key?: string | null;
  contact?: { name: string | null; platform: string; channel: string } | null;
};

const SELECT =
  "id, organization_id, name, is_active, priority, platform, trigger, match_type, keywords, action, response_text, response_variations, set_status, cooldown_seconds, daily_limit, created_at, target_post_ids, comment_reply_text, comment_reply_variations, dm_link_url, dm_button_label, dm_attachment_url, dm_attachment_type, follower_condition, require_follow, follow_prompt_text";

const ruleInput = z.object({
  name: z.string().trim().min(1).max(80),
  isActive: z.boolean(),
  priority: z.number().int().min(1).max(999),
  platform: z.enum(["instagram", "facebook", "youtube"]).nullable(),
  trigger: z.enum(["dm_received", "comment_received", "story_reply", "story_mention"]),
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
  targetPostIds: z.array(z.string().trim().min(1).max(120)).max(50),
  commentReplyText: z.string().trim().max(1000).nullable(),
  commentReplyVariations: z.array(z.string().trim().min(1).max(1000)).max(10),
  dmLinkUrl: z.string().trim().url().max(500).nullable().or(z.literal("").transform(() => null)),
  dmButtonLabel: z.string().trim().max(20).nullable(),
  dmAttachmentUrl: z
    .string()
    .trim()
    .url()
    .max(500)
    .nullable()
    .or(z.literal("").transform(() => null)),
  dmAttachmentType: z.enum(["none", "image", "video", "file"]),
  followerCondition: z.enum(["any", "followers_only", "non_followers"]),
  requireFollow: z.boolean(),
  followPromptText: z.string().trim().max(1000).nullable(),
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
    target_post_ids: input.targetPostIds,
    comment_reply_text: input.commentReplyText,
    comment_reply_variations: input.commentReplyVariations,
    dm_link_url: input.dmLinkUrl,
    dm_button_label: input.dmButtonLabel,
    dm_attachment_url: input.dmAttachmentUrl,
    dm_attachment_type: input.dmAttachmentType,
    follower_condition: input.followerCondition,
    require_follow: input.requireFollow,
    follow_prompt_text: input.followPromptText,
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
    assertPolicy(rest);
    if (rest.isActive) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { assertRuleSlot } = await import("@/lib/plan-limits.server");
      await assertRuleSlot(supabaseAdmin, organizationId);
    }
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
    assertPolicy(rest);
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
    if (rest.targetPostIds !== undefined) patch.target_post_ids = rest.targetPostIds;
    if (rest.commentReplyText !== undefined)
      patch.comment_reply_text = rest.commentReplyText;
    if (rest.commentReplyVariations !== undefined)
      patch.comment_reply_variations = rest.commentReplyVariations;
    if (rest.dmLinkUrl !== undefined) patch.dm_link_url = rest.dmLinkUrl;
    if (rest.dmButtonLabel !== undefined) patch.dm_button_label = rest.dmButtonLabel;
    if (rest.dmAttachmentUrl !== undefined) patch.dm_attachment_url = rest.dmAttachmentUrl;
    if (rest.dmAttachmentType !== undefined)
      patch.dm_attachment_type = rest.dmAttachmentType;
    if (rest.followerCondition !== undefined)
      patch.follower_condition = rest.followerCondition;
    if (rest.requireFollow !== undefined) patch.require_follow = rest.requireFollow;
    if (rest.followPromptText !== undefined)
      patch.follow_prompt_text = rest.followPromptText;

    if (rest.isActive === true) {
      const { data: current } = await context.supabase
        .from("automation_rules")
        .select("organization_id, is_active")
        .eq("id", id)
        .maybeSingle();
      if (current && !current.is_active) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { assertRuleSlot } = await import("@/lib/plan-limits.server");
        await assertRuleSlot(supabaseAdmin, current.organization_id, id);
      }
    }
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
    z
      .object({
        organizationId: z.string().uuid(),
        limit: z.number().int().min(1).max(500).optional(),
        source: z.enum(["flows", "rules", "system"]).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("automation_runs")
      .select("id, rule_id, conversation_id, status, detail, created_at, run_key, conversations(external_user_name, platform, channel)")
      .eq("organization_id", data.organizationId);
    if (data.source === "flows") query = query.like("detail", "flow:%");
    if (data.source === "rules") query = query.not("rule_id", "is", null).or("detail.is.null,detail.not.like.flow:%");
    if (data.source === "system") query = query.is("rule_id", null).or("detail.is.null,detail.not.like.flow:%");
    const { data: rows, error } = await query.order("created_at", { ascending: false }).limit(data.limit ?? 40);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => {
      const { conversations: c, ...rest } = r as typeof r & { conversations: { external_user_name: string | null; platform: string; channel: string } | null };
      return { ...rest, contact: c ? { name: c.external_user_name, platform: c.platform, channel: c.channel } : null } as AutomationRun;
    });
  });

// ---------------------------------------------------------- activity feed

export type ActivityFeedItem = {
  id: string;
  kind: "run" | "webhook";
  tone: "success" | "info" | "warning" | "danger" | "neutral";
  title: string;
  detail: string | null;
  hint: string;
  at: string;
};

/**
 * Org-scoped live activity: every automation fire/skip/fail plus the raw
 * comment/DM events Meta delivers, in one timeline. RLS restricts both
 * tables to members of the workspace.
 */
export const listOrgActivityFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ organizationId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<ActivityFeedItem[]> => {
    const [runs, hooks, rules] = await Promise.all([
      context.supabase
        .from("automation_runs")
        .select("id, rule_id, status, detail, created_at")
        .eq("organization_id", data.organizationId)
        .order("created_at", { ascending: false })
        .limit(25),
      context.supabase
        .from("webhook_events")
        .select("id, platform, event_type, status, error, received_at")
        .eq("organization_id", data.organizationId)
        .order("received_at", { ascending: false })
        .limit(25),
      context.supabase
        .from("automation_rules")
        .select("id, name")
        .eq("organization_id", data.organizationId),
    ]);
    if (runs.error) throw new Error(runs.error.message);
    if (hooks.error) throw new Error(hooks.error.message);

    const ruleName = new Map((rules.data ?? []).map((r) => [r.id, r.name]));
    const items: ActivityFeedItem[] = [];

    for (const r of runs.data ?? []) {
      const { title, hint } = explainReason(r.detail);
      const rule = activityName(r, (id) => id ? ruleName.get(id) ?? "Deleted rule" : "System / safety");
      const sent = r.status === "sent" || r.status === "matched";
      items.push({
        id: `run-${r.id}`,
        kind: "run",
        tone: r.status === "failed" ? "danger" : r.status === "skipped" ? "warning" : "success",
        title: sent
          ? `${rule}: ${stepLabel(r.detail)}`
          : rule
            ? `${title} — ${rule}`
            : title,
        detail: r.detail,
        hint: sent ? "" : hint,
        at: r.created_at,
      });
    }

    for (const h of hooks.data ?? []) {
      const label = webhookEventLabel(h.event_type, h.platform);
      const failed = h.status === "failed";
      items.push({
        id: `hook-${h.id}`,
        kind: "webhook",
        tone: failed ? "danger" : h.status === "ignored" ? "neutral" : "info",
        title: failed ? `${label} — processing failed` : label,
        detail: h.error,
        hint: failed ? "This event could not be processed — reconnect the account if it repeats." : "",
        at: h.received_at,
      });
    }

    items.sort((a, b) => (a.at < b.at ? 1 : -1));
    return items.slice(0, 30);
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
    const locked = await readSafetyLock(data.organizationId);
    return { locked, ...((row ?? {
      organization_id: data.organizationId,
      is_paused: false,
      blocked_keywords: [],
      opt_out_keywords: ["stop", "unsubscribe", "stop messaging"],
      per_contact_daily_limit: 3,
      quiet_hours_enabled: true,
      quiet_hours_start: 22,
      quiet_hours_end: 7,
      timezone_offset_minutes: 330,
      hourly_send_limit: 60,
      daily_send_limit: 500,
      viral_guard_enabled: true,
      viral_threshold_per_minute: 20,
      viral_cooldown_minutes: 15,
      auto_paused_until: null,
      auto_pause_reason: null,
    }) as AutomationSettings) } as AutomationSettings & { locked: boolean };
  });

async function readSafetyLock(orgId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("platform_settings")
    .select("feature_flags")
    .eq("id", true)
    .maybeSingle();
  return ((data?.feature_flags as Record<string, unknown> | null) ?? {})[`safety_locked_${orgId}`] === true;
}

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
    if (await readSafetyLock(data.organizationId)) {
      throw new Error("Safety settings are locked by the platform admin");
    }
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

    const runCount = (
      status: "matched" | "sent" | "skipped" | "failed",
      since: string,
    ) =>
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
      hourlyLimit: settings.data?.hourly_send_limit ?? 60,
      dailyLimit: settings.data?.daily_send_limit ?? 500,
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

// ------------------------------------------------------- post targeting

export type TargetablePost = {
  id: string;
  externalPostId: string;
  platform: "instagram" | "facebook" | "youtube";
  caption: string;
  mediaUrl: string | null;
  permalink: string | null;
  publishedAt: string | null;
};

export type RemotePostItem = {
  id: string;
  externalPostId: string;
  socialAccountId: string;
  platform: "instagram" | "facebook" | "youtube";
  accountName: string;
  mediaType: string | null;
  caption: string;
  mediaUrl: string | null;
  permalink: string | null;
  publishedAt: string | null;
};

/** Recent posts pulled live from the connected Instagram / Facebook accounts. */
export const listRecentRemotePosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ organizationId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    // RLS check: the caller must be able to see this org's accounts.
    const { data: visible, error } = await context.supabase
      .from("social_accounts")
      .select("id")
      .eq("organization_id", data.organizationId)
      .limit(1);
    if (error) throw new Error(error.message);
    if (!visible || visible.length === 0) {
      return { posts: [] as RemotePostItem[], warnings: [] as string[] };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchRemotePosts } = await import("@/lib/remote-posts.server");
    const result = await fetchRemotePosts(supabaseAdmin, data.organizationId, 500);
    return { posts: result.posts as RemotePostItem[], warnings: result.warnings };
  });

/** Published posts that can be used to scope an automation to one post. */
export const listTargetablePosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ organizationId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("posts")
      .select("id, platform, caption, media_url, media_urls, permalink, external_post_id, published_at")
      .eq("organization_id", data.organizationId)
      .eq("status", "published")
      .not("external_post_id", "is", null)
      .order("published_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    const { youtubeThumbnail } = await import("@/lib/post-thumbnail");
    return (rows ?? []).map((row) => ({
      id: row.id,
      externalPostId: row.external_post_id as string,
      platform: row.platform,
      caption: row.caption ?? "",
      mediaUrl:
        row.platform === "youtube"
          ? youtubeThumbnail(row.external_post_id as string)
          : row.media_url ?? row.media_urls?.[0] ?? null,
      permalink: row.permalink,
      publishedAt: row.published_at,
    })) as TargetablePost[];
  });

// ---------------------------------------------------------- run detail

export type AutomationRunDetail = {
  run: AutomationRun;
  rule: {
    id: string;
    name: string;
    trigger: string;
    action: string;
    match_type: string;
    keywords: string[];
    follower_condition: string;
    require_follow: boolean;
    dm_link_url: string | null;
    dm_button_label: string | null;
    dm_attachment_type: string;
  } | null;
  contact: {
    name: string | null;
    externalUserId: string;
    platform: string;
    channel: string;
    status: string;
  } | null;
  timeline: AutomationRun[];
  messages: { id: string; direction: string; body: string; sent_at: string }[];
};

/** One automation step plus its rule, contact, surrounding steps and messages. */
export const getAutomationRunDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ organizationId: z.string().uuid(), runId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<AutomationRunDetail> => {
    const sb = context.supabase;
    const { data: run, error } = await sb
      .from("automation_runs")
      .select("id, rule_id, conversation_id, status, detail, created_at")
      .eq("organization_id", data.organizationId)
      .eq("id", data.runId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!run) throw new Error("Activity not found");

    const at = new Date(run.created_at).getTime();
    const from = new Date(at - 30 * 60 * 1000).toISOString();
    const to = new Date(at + 30 * 60 * 1000).toISOString();

    const [ruleRes, convRes, timelineRes, msgRes] = await Promise.all([
      run.rule_id
        ? sb
            .from("automation_rules")
            .select(
              "id, name, trigger, action, match_type, keywords, follower_condition, require_follow, dm_link_url, dm_button_label, dm_attachment_type",
            )
            .eq("id", run.rule_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      run.conversation_id
        ? sb
            .from("conversations")
            .select("external_user_name, external_user_id, platform, channel, status")
            .eq("id", run.conversation_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      run.conversation_id
        ? sb
            .from("automation_runs")
            .select("id, rule_id, conversation_id, status, detail, created_at")
            .eq("organization_id", data.organizationId)
            .eq("conversation_id", run.conversation_id)
            .gte("created_at", from)
            .lte("created_at", to)
            .order("created_at", { ascending: true })
            .limit(50)
        : Promise.resolve({ data: [run] }),
      run.conversation_id
        ? sb
            .from("messages")
            .select("id, direction, body, sent_at")
            .eq("conversation_id", run.conversation_id)
            .gte("sent_at", from)
            .lte("sent_at", to)
            .order("sent_at", { ascending: true })
            .limit(50)
        : Promise.resolve({ data: [] }),
    ]);

    const conv = convRes.data as {
      external_user_name: string | null;
      external_user_id: string;
      platform: string;
      channel: string;
      status: string;
    } | null;

    return {
      run: run as AutomationRun,
      rule: (ruleRes.data as AutomationRunDetail["rule"]) ?? null,
      contact: conv
        ? {
            name: conv.external_user_name,
            externalUserId: conv.external_user_id,
            platform: conv.platform,
            channel: conv.channel,
            status: conv.status,
          }
        : null,
      timeline: ((timelineRes.data ?? []) as AutomationRun[]),
      messages: (msgRes.data ?? []) as AutomationRunDetail["messages"],
    };
  });
