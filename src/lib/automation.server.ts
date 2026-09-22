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
  /** Post/media id the comment belongs to (comment channel only). */
  postExternalId?: string | null;
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
  target_post_ids: string[] | null;
  comment_reply_text: string | null;
  comment_reply_variations: string[] | null;
  dm_link_url: string | null;
  dm_button_label: string | null;
  dm_attachment_url: string | null;
  dm_attachment_type: string;
  follower_condition: string;
  require_follow: boolean;
  follow_prompt_text: string | null;
};

const RULE_SELECT =
  "id, name, platform, trigger, match_type, keywords, action, response_text, response_variations, set_status, cooldown_seconds, daily_limit, target_post_ids, comment_reply_text, comment_reply_variations, dm_link_url, dm_button_label, dm_attachment_url, dm_attachment_type, follower_condition, require_follow, follow_prompt_text";

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

/** Pick one text at random from a primary text plus its variations. */
function pickFrom(primary: string | null, variations: string[] | null | undefined) {
  const options = [primary, ...(variations ?? [])]
    .map((t) => (t ?? "").trim())
    .filter(Boolean);
  if (options.length === 0) return null;
  return options[Math.floor(Math.random() * options.length)]!;
}

/** Rotate deterministically-random across the available response texts. */
function pickResponse(rule: Rule) {
  return pickFrom(rule.response_text, rule.response_variations);
}

/** A rule with no selected posts applies everywhere. */
function targetsPost(rule: Rule, postExternalId: string | null) {
  const targets = (rule.target_post_ids ?? []).map((t) => t.trim()).filter(Boolean);
  if (targets.length === 0) return true;
  if (!postExternalId) return false;
  return targets.some((t) => t === postExternalId || postExternalId.endsWith(`_${t}`));
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

  // Platform-wide kill switch controlled from the operations console.
  const { data: platform } = await admin
    .from("platform_settings")
    .select("global_send_paused")
    .eq("id", true)
    .maybeSingle();
  if (platform?.global_send_paused) {
    await log(admin, ctx, null, "skipped", "platform_send_paused");
    return;
  }



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
    .select(RULE_SELECT)
    .eq("organization_id", ctx.organizationId)
    .eq("is_active", true)
    .eq("trigger", trigger)
    .order("priority", { ascending: true });

  const candidates = ((rules ?? []) as Rule[]).filter(
    (r) =>
      (!r.platform || r.platform === ctx.platform) &&
      targetsPost(r, ctx.postExternalId ?? null) &&
      matches(r, ctx.body),
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
    const accountId = account.external_id as string;

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

    // 1) Public reply under the comment (runs alongside the DM action).
    let commentReplied = false;
    if (ctx.channel === "comment" && ctx.externalId) {
      const commentText = pickFrom(rule.comment_reply_text, rule.comment_reply_variations);
      if (commentText) {
        const res = await call(`${GRAPH}/${ctx.externalId}/replies`, {
          message: commentText,
          access_token: token,
        });
        if (res.error) {
          await log(admin, ctx, rule.id, "failed", `comment_reply:${res.error.slice(0, 200)}`);
        } else {
          commentReplied = true;
          await recordOutbound(admin, ctx, rule, `[public reply] ${commentText}`, res.id ?? null);
          await log(admin, ctx, rule.id, "sent", "comment_reply");
        }
      }
    }

    const text = pickResponse(rule);
    if (!text) {
      if (!commentReplied) await log(admin, ctx, rule.id, "failed", "no_response_text");
      return;
    }

    // 2) Follower conditions and follow gate.
    if (rule.follower_condition !== "any" || rule.require_follow) {
      const follows = await checkFollows(ctx.platform, ctx.externalUserId, token);
      if (follows === false && rule.follower_condition === "followers_only") {
        await log(admin, ctx, rule.id, "skipped", "not_a_follower");
        return;
      }
      if (follows === true && rule.follower_condition === "non_followers") {
        await log(admin, ctx, rule.id, "skipped", "already_a_follower");
        return;
      }
      if (follows === false && rule.require_follow) {
        await openFollowGate(admin, ctx, rule, token, accountId);
        return;
      }
    }

    await deliverDm(admin, ctx, rule, token, accountId, text);
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

// ------------------------------------------------------------- delivery

function actionRecipient(ctx: AutomationContext, action: string) {
  if (action === "comment_private_reply" && ctx.externalId) {
    return { comment_id: ctx.externalId };
  }
  return { id: ctx.externalUserId };
}

async function recordOutbound(
  admin: AdminClient,
  ctx: AutomationContext,
  rule: Pick<Rule, "name">,
  body: string,
  externalId: string | null,
) {
  const now = new Date().toISOString();
  await admin.from("messages").insert({
    conversation_id: ctx.conversationId,
    direction: "outbound",
    body,
    external_id: externalId,
    sender_name: `Automation · ${rule.name}`,
    sent_at: now,
  });
  await admin
    .from("conversations")
    .update({
      last_message_at: now,
      last_message_preview: body.slice(0, 140),
      status: "pending",
    })
    .eq("id", ctx.conversationId);
}

/** Send the rule's DM: text (+link), optional button, optional attachment. */
async function deliverDm(
  admin: AdminClient,
  ctx: AutomationContext,
  rule: Rule,
  token: string,
  accountId: string,
  text: string,
) {
  if (rule.action === "comment_public_reply") {
    if (!ctx.externalId) {
      await log(admin, ctx, rule.id, "failed", "no_comment_id");
      return;
    }
    const res = await call(`${GRAPH}/${ctx.externalId}/replies`, {
      message: text,
      access_token: token,
    });
    if (res.error) {
      await log(admin, ctx, rule.id, "failed", res.error.slice(0, 300));
      return;
    }
    await recordOutbound(admin, ctx, rule, `[public reply] ${text}`, res.id ?? null);
    await log(admin, ctx, rule.id, "sent", rule.action);
    return;
  }

  if (rule.action !== "reply_dm" && rule.action !== "comment_private_reply") {
    await log(admin, ctx, rule.id, "skipped", "unknown_action");
    return;
  }

  const link = (rule.dm_link_url ?? "").trim();
  const buttonLabel = (rule.dm_button_label ?? "").trim();
  const withLink = link && !buttonLabel ? `${text}\n${link}` : text;

  const message =
    link && buttonLabel
      ? {
          attachment: {
            type: "template",
            payload: {
              template_type: "button",
              text: withLink,
              buttons: [{ type: "web_url", url: link, title: buttonLabel.slice(0, 20) }],
            },
          },
        }
      : { text: withLink };

  const recipient = actionRecipient(ctx, rule.action);
  const first = await call(`${GRAPH}/${accountId}/messages`, {
    recipient,
    message,
    access_token: token,
  });
  if (first.error) {
    await log(admin, ctx, rule.id, "failed", first.error.slice(0, 300));
    return;
  }

  const attachmentUrl = (rule.dm_attachment_url ?? "").trim();
  if (attachmentUrl && rule.dm_attachment_type && rule.dm_attachment_type !== "none") {
    const media = await call(`${GRAPH}/${accountId}/messages`, {
      recipient: { id: ctx.externalUserId },
      message: {
        attachment: {
          type: rule.dm_attachment_type,
          payload: { url: attachmentUrl, is_reusable: true },
        },
      },
      access_token: token,
    });
    if (media.error) {
      await log(admin, ctx, rule.id, "failed", `attachment:${media.error.slice(0, 200)}`);
    }
  }

  const prefix = rule.action === "comment_private_reply" ? "[private reply] " : "";
  await recordOutbound(admin, ctx, rule, `${prefix}${withLink}`, first.id ?? null);
  await log(admin, ctx, rule.id, "sent", rule.action);
}

// ------------------------------------------------------------- follow gate

/**
 * Instagram exposes whether the contact follows the business on the
 * conversation user profile. Facebook has no equivalent field, so unknown
 * (null) never blocks a send.
 */
async function checkFollows(
  platform: "instagram" | "facebook",
  externalUserId: string,
  token: string,
): Promise<boolean | null> {
  if (platform !== "instagram") return null;
  try {
    const response = await fetch(
      `${GRAPH}/${externalUserId}?fields=is_user_follow_business&access_token=${encodeURIComponent(token)}`,
    );
    const json = (await response.json()) as {
      is_user_follow_business?: boolean;
      error?: unknown;
    };
    if (!response.ok || typeof json.is_user_follow_business !== "boolean") return null;
    return json.is_user_follow_business;
  } catch {
    return null;
  }
}

const FOLLOW_PAYLOAD = "AUTOMATION_FOLLOW_CHECK";
const DEFAULT_FOLLOW_PROMPT =
  "Please follow us first so we can send you the details — then tap the button below.";

/** Ask the contact to follow, with a one-tap "I followed" button. */
async function openFollowGate(
  admin: AdminClient,
  ctx: AutomationContext,
  rule: Rule,
  token: string,
  accountId: string,
) {
  const { data: gate } = await admin
    .from("automation_follow_gates")
    .insert({
      organization_id: ctx.organizationId,
      rule_id: rule.id,
      conversation_id: ctx.conversationId,
      social_account_id: ctx.socialAccountId,
      platform: ctx.platform,
      external_user_id: ctx.externalUserId,
      comment_external_id: ctx.channel === "comment" ? ctx.externalId : null,
      status: "waiting",
    })
    .select("id")
    .single();

  const prompt = (rule.follow_prompt_text ?? "").trim() || DEFAULT_FOLLOW_PROMPT;
  const res = await call(`${GRAPH}/${accountId}/messages`, {
    recipient: actionRecipient(ctx, rule.action),
    message: {
      text: prompt,
      quick_replies: [
        {
          content_type: "text",
          title: "I followed ✅",
          payload: `${FOLLOW_PAYLOAD}:${gate?.id ?? ""}`,
        },
      ],
    },
    access_token: token,
  });

  if (res.error) {
    await log(admin, ctx, rule.id, "failed", `follow_prompt:${res.error.slice(0, 200)}`);
    return;
  }
  await recordOutbound(admin, ctx, rule, prompt, res.id ?? null);
  await log(admin, ctx, rule.id, "sent", "follow_prompt");
}

/**
 * Called from the webhook when the contact taps "I followed" (quick reply or
 * postback). Re-checks the follow status and releases the held DM.
 */
export async function handleFollowGateReply(
  admin: AdminClient,
  args: {
    organizationId: string;
    conversationId: string;
    socialAccountId: string | null;
    platform: "instagram" | "facebook";
    externalUserId: string;
    payload: string;
  },
) {
  if (!args.payload.startsWith(FOLLOW_PAYLOAD)) return false;
  const gateId = args.payload.split(":")[1] ?? "";

  const query = admin
    .from("automation_follow_gates")
    .select("id, rule_id, attempts, comment_external_id")
    .eq("organization_id", args.organizationId)
    .eq("external_user_id", args.externalUserId)
    .eq("status", "waiting")
    .order("created_at", { ascending: false })
    .limit(1);
  const { data: gates } = gateId ? await query.eq("id", gateId) : await query;
  const gate = gates?.[0];
  if (!gate?.rule_id) return true;

  const { data: rule } = await admin
    .from("automation_rules")
    .select(RULE_SELECT)
    .eq("id", gate.rule_id)
    .maybeSingle();
  if (!rule) return true;
  const typedRule = rule as unknown as Rule;

  const ctx: AutomationContext = {
    organizationId: args.organizationId,
    conversationId: args.conversationId,
    socialAccountId: args.socialAccountId,
    platform: args.platform,
    channel: "dm",
    body: "",
    externalUserId: args.externalUserId,
    externalId: null,
  };

  if (!args.socialAccountId) return true;
  const [{ data: tokenRow }, { data: account }] = await Promise.all([
    admin
      .from("social_account_tokens")
      .select("access_token")
      .eq("social_account_id", args.socialAccountId)
      .maybeSingle(),
    admin
      .from("social_accounts")
      .select("external_id")
      .eq("id", args.socialAccountId)
      .maybeSingle(),
  ]);
  const token = tokenRow?.access_token as string | undefined;
  if (!token || !account?.external_id) return true;

  const follows = await checkFollows(args.platform, args.externalUserId, token);
  const attempts = (gate.attempts ?? 0) + 1;

  if (follows === false && attempts < 3) {
    await admin
      .from("automation_follow_gates")
      .update({ attempts, last_checked_at: new Date().toISOString() })
      .eq("id", gate.id);
    const retry = (typedRule.follow_prompt_text ?? "").trim() || DEFAULT_FOLLOW_PROMPT;
    await call(`${GRAPH}/${account.external_id}/messages`, {
      recipient: { id: args.externalUserId },
      message: {
        text: `We can't see the follow yet. ${retry}`,
        quick_replies: [
          {
            content_type: "text",
            title: "I followed ✅",
            payload: `${FOLLOW_PAYLOAD}:${gate.id}`,
          },
        ],
      },
      access_token: token,
    });
    await log(admin, ctx, typedRule.id, "skipped", "follow_not_confirmed");
    return true;
  }

  await admin
    .from("automation_follow_gates")
    .update({
      attempts,
      status: follows === false ? "expired" : "completed",
      last_checked_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    })
    .eq("id", gate.id);

  if (follows === false) {
    await log(admin, ctx, typedRule.id, "skipped", "follow_gate_expired");
    return true;
  }

  const text = pickResponse(typedRule);
  if (!text) return true;
  await deliverDm(
    admin,
    ctx,
    { ...typedRule, action: "reply_dm" },
    token,
    account.external_id as string,
    text,
  );
  return true;
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
