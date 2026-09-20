/**
 * Automation engine V1 (Phase 8).
 * Runs server-side right after an inbound message is ingested from a webhook.
 * Safety: rule cooldown per conversation, daily cap per rule, never reacts to
 * outbound/automated messages, and every attempt is logged in automation_runs.
 */

type AdminClient = import("@supabase/supabase-js").SupabaseClient;

const GRAPH = "https://graph.facebook.com/v21.0";

export type AutomationContext = {
  organizationId: string;
  conversationId: string;
  socialAccountId: string | null;
  platform: "instagram" | "facebook";
  channel: string; // "dm" | "comment"
  body: string;
  externalUserId: string;
  /** Comment id for comment channel, message id for DMs. */
  externalId: string | null;
};

type Rule = {
  id: string;
  name: string;
  platform: string | null;
  trigger: string;
  match_type: string;
  keywords: string[];
  action: string;
  response_text: string | null;
  response_variations: string[] | null;
  set_status: string | null;
  cooldown_seconds: number;
  daily_limit: number;
};

type Settings = {
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

const DEFAULT_SETTINGS: Settings = {
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
};


function inQuietHours(s: Settings, now = new Date()) {
  if (!s.quiet_hours_enabled) return false;
  const local = new Date(now.getTime() + s.timezone_offset_minutes * 60 * 1000);
  const hour = local.getUTCHours();
  const { quiet_hours_start: start, quiet_hours_end: end } = s;
  if (start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

function hitsKeyword(list: string[] | null | undefined, body: string) {
  const text = body.toLowerCase();
  return (list ?? [])
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)
    .find((k) => text.includes(k));
}

/** Rotate deterministically-random across the available response texts. */
function pickResponse(rule: Rule) {
  const options = [rule.response_text, ...(rule.response_variations ?? [])]
    .map((t) => (t ?? "").trim())
    .filter(Boolean);
  if (options.length === 0) return null;
  return options[Math.floor(Math.random() * options.length)]!;
}

function matches(rule: Rule, body: string) {
  if (rule.match_type === "any") return true;
  const text = body.toLowerCase();
  const keys = (rule.keywords ?? []).map((k) => k.trim().toLowerCase()).filter(Boolean);
  if (keys.length === 0) return false;
  return keys.some((k) => {
    if (rule.match_type === "exact") return text.trim() === k;
    if (rule.match_type === "starts_with") return text.trim().startsWith(k);
    return text.includes(k);
  });
}


async function log(
  admin: AdminClient,
  ctx: AutomationContext,
  ruleId: string | null,
  status: "matched" | "sent" | "skipped" | "failed",
  detail?: string,
) {
  await admin.from("automation_runs").insert({
    organization_id: ctx.organizationId,
    rule_id: ruleId,
    conversation_id: ctx.conversationId,
    status,
    detail: detail ?? null,
  });
}

export async function runAutomations(admin: AdminClient, ctx: AutomationContext) {
  const trigger = ctx.channel === "comment" ? "comment_received" : "dm_received";

  const { data: settingsRow } = await admin
    .from("automation_settings")
    .select(
      "is_paused, blocked_keywords, opt_out_keywords, per_contact_daily_limit, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, timezone_offset_minutes, hourly_send_limit, daily_send_limit, viral_guard_enabled, viral_threshold_per_minute, viral_cooldown_minutes, auto_paused_until, auto_pause_reason",
    )
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  const settings: Settings = { ...DEFAULT_SETTINGS, ...(settingsRow ?? {}) } as Settings;

  // Safety: org kill switch.
  if (settings.is_paused) {
    await log(admin, ctx, null, "skipped", "automation_paused");
    return;
  }

  // Viral protection: a spike auto-pauses automation for a cooldown window.
  if (settings.auto_paused_until && new Date(settings.auto_paused_until) > new Date()) {
    await log(
      admin,
      ctx,
      null,
      "skipped",
      `auto_paused:${settings.auto_pause_reason ?? "spike"}`,
    );
    return;
  }

  if (settings.viral_guard_enabled) {
    const minuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const { count: burst } = await admin
      .from("webhook_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ctx.organizationId)
      .gte("received_at", minuteAgo);
    if ((burst ?? 0) >= settings.viral_threshold_per_minute) {
      const until = new Date(
        Date.now() + settings.viral_cooldown_minutes * 60 * 1000,
      ).toISOString();
      await admin.from("automation_settings").upsert(
        {
          organization_id: ctx.organizationId,
          auto_paused_until: until,
          auto_pause_reason: `traffic spike (${burst}/min)`,
        },
        { onConflict: "organization_id" },
      );
      await log(admin, ctx, null, "skipped", `viral_guard:${burst}_per_min`);
      return;
    }
  }

  // Quota: org-wide hourly and daily send caps.
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const dayStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [{ count: sentHour }, { count: sentDay }] = await Promise.all([
    admin
      .from("automation_runs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ctx.organizationId)
      .eq("status", "sent")
      .gte("created_at", hourAgo),
    admin
      .from("automation_runs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ctx.organizationId)
      .eq("status", "sent")
      .gte("created_at", dayStart),
  ]);
  if ((sentHour ?? 0) >= settings.hourly_send_limit) {
    await log(admin, ctx, null, "skipped", "org_hourly_limit");
    return;
  }
  if ((sentDay ?? 0) >= settings.daily_send_limit) {
    await log(admin, ctx, null, "skipped", "org_daily_limit");
    return;
  }

  // Safety: contact asked to stop -> record opt-out and never auto-reply again.
  const optOutHit = hitsKeyword(settings.opt_out_keywords, ctx.body);
  if (optOutHit) {
    await admin.from("automation_opt_outs").upsert(
      {
        organization_id: ctx.organizationId,
        platform: ctx.platform,
        external_user_id: ctx.externalUserId,
        reason: `keyword:${optOutHit}`,
      },
      { onConflict: "organization_id,platform,external_user_id" },
    );
    await log(admin, ctx, null, "skipped", `opt_out:${optOutHit}`);
    return;
  }


  const { data: optedOut } = await admin
    .from("automation_opt_outs")
    .select("id")
    .eq("organization_id", ctx.organizationId)
    .eq("platform", ctx.platform)
    .eq("external_user_id", ctx.externalUserId)
    .maybeSingle();
  if (optedOut) {
    await log(admin, ctx, null, "skipped", "contact_opted_out");
    return;
  }

  // Safety: sensitive/blocked words go to a human instead of an auto-reply.
  const blockedHit = hitsKeyword(settings.blocked_keywords, ctx.body);
  if (blockedHit) {
    await admin
      .from("conversations")
      .update({ status: "open" })
      .eq("id", ctx.conversationId);
    await log(admin, ctx, null, "skipped", `blocked_keyword:${blockedHit}`);
    return;
  }

  // Safety: quiet hours.
  if (inQuietHours(settings)) {
    await log(admin, ctx, null, "skipped", "quiet_hours");
    return;
  }

  // Safety: per-contact daily cap across all rules.
  const contactSince = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: contactSends } = await admin
    .from("automation_runs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ctx.organizationId)
    .eq("conversation_id", ctx.conversationId)
    .eq("status", "sent")
    .gte("created_at", contactSince);
  if ((contactSends ?? 0) >= settings.per_contact_daily_limit) {
    await log(admin, ctx, null, "skipped", "per_contact_limit");
    return;
  }

  const { data: rules } = await admin
    .from("automation_rules")
    .select(
      "id, name, platform, trigger, match_type, keywords, action, response_text, response_variations, set_status, cooldown_seconds, daily_limit",
    )
    .eq("organization_id", ctx.organizationId)
    .eq("is_active", true)
    .eq("trigger", trigger)
    .order("priority", { ascending: true });

  const candidates = ((rules ?? []) as Rule[]).filter(
    (r) => (!r.platform || r.platform === ctx.platform) && matches(r, ctx.body),
  );
  if (candidates.length === 0) return;


  // Only the highest-priority matching rule fires (anti-spam).
  const rule = candidates[0]!;

  // Cooldown: skip if this rule already acted on this conversation recently.
  const since = new Date(Date.now() - rule.cooldown_seconds * 1000).toISOString();
  const { count: recent } = await admin
    .from("automation_runs")
    .select("id", { count: "exact", head: true })
    .eq("rule_id", rule.id)
    .eq("conversation_id", ctx.conversationId)
    .eq("status", "sent")
    .gte("created_at", since);
  if ((recent ?? 0) > 0) {
    await log(admin, ctx, rule.id, "skipped", "cooldown");
    return;
  }

  // Daily cap per rule.
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: today } = await admin
    .from("automation_runs")
    .select("id", { count: "exact", head: true })
    .eq("rule_id", rule.id)
    .eq("status", "sent")
    .gte("created_at", dayAgo);
  if ((today ?? 0) >= rule.daily_limit) {
    await log(admin, ctx, rule.id, "skipped", "daily_limit");
    return;
  }

  try {
    if (rule.action === "set_status") {
      await admin
        .from("conversations")
        .update({ status: rule.set_status ?? "pending" })
        .eq("id", ctx.conversationId);
      await log(admin, ctx, rule.id, "sent", `status:${rule.set_status ?? "pending"}`);
      return;
    }

    if (!ctx.socialAccountId) {
      await log(admin, ctx, rule.id, "failed", "no_account");
      return;
    }
    const [{ data: tokenRow }, { data: account }] = await Promise.all([
      admin
        .from("social_account_tokens")
        .select("access_token")
        .eq("social_account_id", ctx.socialAccountId)
        .maybeSingle(),
      admin
        .from("social_accounts")
        .select("external_id")
        .eq("id", ctx.socialAccountId)
        .maybeSingle(),
    ]);
    const token = tokenRow?.access_token as string | undefined;
    if (!token || !account?.external_id) {
      await log(admin, ctx, rule.id, "failed", "no_token");
      return;
    }

    const text = pickResponse(rule);

    if (rule.action === "hide_comment") {
      if (!ctx.externalId) {
        await log(admin, ctx, rule.id, "failed", "no_comment_id");
        return;
      }
      const res = await call(`${GRAPH}/${ctx.externalId}`, { hide: true, access_token: token });
      if (res.error) {
        await log(admin, ctx, rule.id, "failed", res.error);
        return;
      }
      await log(admin, ctx, rule.id, "sent", "hidden");
      return;
    }

    if (!text) {
      await log(admin, ctx, rule.id, "failed", "no_response_text");
      return;
    }

    let result: { id?: string | undefined; error?: string | undefined };
    let prefix = "";

    if (rule.action === "reply_dm") {
      result = await call(`${GRAPH}/${account.external_id}/messages`, {
        recipient: { id: ctx.externalUserId },
        message: { text },
        access_token: token,
      });
    } else if (rule.action === "comment_public_reply") {
      if (!ctx.externalId) {
        await log(admin, ctx, rule.id, "failed", "no_comment_id");
        return;
      }
      prefix = "[public reply] ";
      result = await call(`${GRAPH}/${ctx.externalId}/replies`, {
        message: text,
        access_token: token,
      });
    } else if (rule.action === "comment_private_reply") {
      if (!ctx.externalId) {
        await log(admin, ctx, rule.id, "failed", "no_comment_id");
        return;
      }
      prefix = "[private reply] ";
      result = await call(`${GRAPH}/${account.external_id}/messages`, {
        recipient: { comment_id: ctx.externalId },
        message: { text },
        access_token: token,
      });
    } else {
      await log(admin, ctx, rule.id, "skipped", "unknown_action");
      return;
    }

    if (result.error) {
      await log(admin, ctx, rule.id, "failed", result.error.slice(0, 300));
      return;
    }

    const now = new Date().toISOString();
    await admin.from("messages").insert({
      conversation_id: ctx.conversationId,
      direction: "outbound",
      body: `${prefix}${text}`,
      external_id: result.id ?? null,
      sender_name: `Automation · ${rule.name}`,
      sent_at: now,
    });
    await admin
      .from("conversations")
      .update({
        last_message_at: now,
        last_message_preview: `${prefix}${text}`.slice(0, 140),
        status: "pending",
      })
      .eq("id", ctx.conversationId);

    await log(admin, ctx, rule.id, "sent", rule.action);
  } catch (error) {
    await log(
      admin,
      ctx,
      rule.id,
      "failed",
      error instanceof Error ? error.message.slice(0, 300) : "unknown_error",
    );
  }
}

async function call(url: string, payload: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await response.json()) as {
    id?: string;
    message_id?: string;
    error?: { message?: string };
  };
  if (!response.ok || json.error) {
    return { error: json.error?.message ?? `HTTP ${response.status}` };
  }
  return { id: json.id ?? json.message_id };
}
