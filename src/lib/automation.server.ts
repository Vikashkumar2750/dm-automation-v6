/**
 * LOCKED — DM automation core. Follower + non-follower flows are verified live.
 * Do NOT change without reading docs/DM-AUTOMATION-LOGIC.md and running
 * `bunx vitest run`. Every regression test must stay green.
 */
/**
 * Automation engine V1 (Phase 8).
 * Runs server-side right after an inbound message is ingested from a webhook.
 * Safety: rule cooldown per conversation, daily cap per rule, never reacts to
 * outbound/automated messages, and every attempt is logged in automation_runs.
 */

import { AsyncLocalStorage } from "node:async_hooks";

import { followGateId } from "@/lib/meta-messaging";
import { trackedUrl } from "@/lib/click-tracking.server";

/** Dry-run context: captures Meta requests instead of sending them. */
export type SimulationCapture = { url: string; payload: Record<string, unknown> };
export type SimulationState = { follows: boolean | null; calls: SimulationCapture[] };
export const simulationStore = new AsyncLocalStorage<SimulationState>();
export function runSimulated<T>(state: SimulationState, fn: () => Promise<T>) {
  return simulationStore.run(state, fn);
}

type AdminClient = import("@supabase/supabase-js").SupabaseClient;

const GRAPH = "https://graph.facebook.com/v21.0";
const IG_GRAPH = "https://graph.instagram.com/v21.0";

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
  correlationId?: string;
  /** Phase A only: explicit trigger (story_reply / story_mention). */
  trigger?: string;
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

/** Comment automations are deduplicated per person + post below. Applying the
 * DM contact cap here would incorrectly block a legitimate comment on another
 * post after the contact has interacted with earlier posts. */
export function usesPerContactDailyLimit(channel: string) {
  return channel !== "comment";
}


async function log(
  admin: AdminClient,
  ctx: AutomationContext,
  ruleId: string | null,
  status: "matched" | "sent" | "skipped" | "failed",
  detail?: string,
) {
  if (ctx.correlationId) {
    console.info(JSON.stringify({
      scope: "automation_trace",
      correlationId: ctx.correlationId,
      stage: detail ?? "automation_run",
      outcome: status,
      organizationId: ctx.organizationId,
      ruleId,
    }));
  }
  await admin.from("automation_runs").insert({
    organization_id: ctx.organizationId,
    rule_id: ruleId,
    conversation_id: ctx.conversationId,
    status,
    detail: detail ?? null,
  });
}

export async function runAutomations(admin: AdminClient, ctx: AutomationContext) {
  const trigger = ctx.trigger ?? (ctx.channel === "comment" ? "comment_received" : "dm_received");

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

  // P2: human takeover — keyword rules stay silent while a team member owns the conversation.
  if (await (await import("@/lib/human-takeover.server")).conversationInTakeover(admin, ctx.conversationId)) {
    await log(admin, ctx, null, "skipped", "human_takeover");
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

  // Plan quota: monthly automated DMs. Only blocks NEW flows — a contact who
  // already has an open follow gate (mid-flow) is never cut off.
  {
    const { resolveOrgLimits, countMonthlySent } = await import("@/lib/plan-limits.server");
    const limits = await resolveOrgLimits(admin, ctx.organizationId).catch(() => null);
    if (limits && limits.monthlyDms !== null) {
      const sentMonth = await countMonthlySent(admin, ctx.organizationId);
      if (sentMonth >= limits.monthlyDms) {
        let midFlow = false;
        if (ctx.channel !== "comment") {
          const { count } = await admin
            .from("automation_follow_gates")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", ctx.organizationId)
            .eq("external_user_id", ctx.externalUserId)
            .is("completed_at", null);
          midFlow = (count ?? 0) > 0;
        }
        if (!midFlow) {
          await log(admin, ctx, null, "skipped", "plan_monthly_dm_limit");
          return;
        }
      }
    }
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

  const { data: rules } = await admin
    .from("automation_rules")
    .select(RULE_SELECT)
    .eq("organization_id", ctx.organizationId)
    .eq("is_active", true)
    .eq("trigger", trigger)
    .order("priority", { ascending: true });

  const activeRules = (rules ?? []) as Rule[];
  const platformRules = activeRules.filter((r) => !r.platform || r.platform === ctx.platform);
  const postRules = platformRules.filter((r) => targetsPost(r, ctx.postExternalId ?? null));
  const candidates = postRules.filter((r) => matches(r, ctx.body));
  if (candidates.length === 0) {
    const reason =
      activeRules.length === 0
        ? `no_active_${trigger}_rule`
        : platformRules.length === 0
          ? "no_matching_rule:platform"
          : postRules.length === 0
            ? "no_matching_rule:post"
            : "no_matching_rule:keyword";
    await log(
      admin,
      ctx,
      null,
      "skipped",
      reason,
    );
    return;
  }


  // Only the highest-priority matching rule fires (anti-spam).
  const rule = candidates[0]!;

  // Safety: cap completed automated DM replies per contact across all rules.
  // A comment + follow-gate flow records intermediate steps (public reply and
  // follow prompt) as sent too. Counting every sent log exhausted the cap
  // before the held DM could be released, so only terminal reply actions count.
  // Comment triggers instead use the stricter per-person + per-post marker,
  // allowing the same person to comment once on each different post.
  if (usesPerContactDailyLimit(ctx.channel)) {
    const contactSince = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: contactSends } = await admin
      .from("automation_runs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ctx.organizationId)
      .eq("conversation_id", ctx.conversationId)
      .eq("status", "sent")
      .in("detail", ["reply_dm", "comment_private_reply", "comment_public_reply"])
      .gte("created_at", contactSince);
    if ((contactSends ?? 0) >= settings.per_contact_daily_limit) {
      await log(admin, ctx, rule.id, "skipped", "per_contact_limit");
      return;
    }
  }

  // Cooldown: skip if this rule already acted on this conversation recently.
  // Comments use "one reply per person per post" instead (checked before the
  // gate opens), so a comment on a DIFFERENT post is never blocked here.
  if (ctx.channel !== "comment") {
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
        .select("external_id, metadata")
        .eq("id", ctx.socialAccountId)
        .maybeSingle(),
    ]);
    const token = (await (await import("@/lib/token-crypto.server")).readToken(tokenRow?.access_token as string | undefined)) ?? undefined;
    if (!token || !account?.external_id) {
      await log(admin, ctx, rule.id, "failed", "no_token");
      return;
    }
    const accountId = messagingAccountId(
      ctx.platform,
      account.external_id as string,
      account.metadata,
    );

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
    if (
      ctx.channel === "comment" &&
      ctx.externalId &&
      rule.action !== "comment_public_reply" // that action posts its own reply below
    ) {
      const commentText = pickFrom(rule.comment_reply_text, rule.comment_reply_variations);
      if (commentText) {
        const res = await call(`${GRAPH}/${ctx.externalId}/${ctx.platform === "facebook" ? "comments" : "replies"}`, {
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

    if (rule.action === "comment_public_reply") {
      await deliverDm(admin, ctx, rule, token, accountId, text);
      return;
    }

    const needsFollowCheck = rule.require_follow || rule.follower_condition !== "any";
    const isCommentDm =
      ctx.channel === "comment" &&
      rule.action === "comment_private_reply" &&
      Boolean(ctx.externalId);

    // 2) Comment → DM. Meta allows exactly ONE private reply per comment and
    //    does not reveal follower status for a commenter who never messaged the
    //    account. So when a follow check or an attachment is needed, the private
    //    reply is a "tap to continue" message with a postback button. The tap
    //    opens the conversation (24h window + profile consent); the webhook then
    //    checks the follow and sends the link button and attachment.
    if (isCommentDm) {
      // Every comment → DM goes through the opener tap so the follower check
      // can run: followers get the final DM directly, non-followers are asked
      // to follow first (plan behaviour for "Everyone").
      // Meta allows one private reply per comment: never open a second gate
      // for the same comment id (re-deliveries, edits, retries).
      const { count: priorGate } = await admin
        .from("automation_follow_gates")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", ctx.organizationId)
        .eq("comment_external_id", ctx.externalId as string);
      if ((priorGate ?? 0) > 0) {
        await log(admin, ctx, rule.id, "skipped", "duplicate_comment");
        return;
      }
      // One reply per person per post (7 days): a second comment by the same
      // person on the SAME post is skipped; other posts still get a reply.
      if (ctx.postExternalId) {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const postMarker = `post_reply:${ctx.postExternalId}`.slice(0, 200);
        const { count: samePost, error: samePostErr } = await admin
          .from("automation_runs")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", ctx.organizationId)
          .eq("conversation_id", ctx.conversationId)
          .eq("detail", postMarker)
          .gte("created_at", weekAgo);
        if (!samePostErr && (samePost ?? 0) > 0) {
          await log(admin, ctx, rule.id, "skipped", "already_replied_on_post");
          return;
        }
        await log(admin, ctx, rule.id, "matched", postMarker);
      }
      await openGate(admin, ctx, rule, token, accountId, "opener");
      return;
    }

    // 3) DM trigger: the conversation is already open, so Meta reveals follows.
    if (needsFollowCheck) {
      const follows = await checkFollows(ctx.platform, ctx.externalUserId, token);
      const verdict = followVerdict(rule, follows);
      if (verdict === "skip_not_follower") {
        await log(admin, ctx, rule.id, "skipped", "not_a_follower");
        return;
      }
      if (verdict === "skip_follower") {
        await log(admin, ctx, rule.id, "skipped", "already_a_follower");
        return;
      }
      if (verdict === "ask_follow") {
        await openGate(admin, ctx, rule, token, accountId, "follow");
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

type FollowVerdict = "deliver" | "ask_follow" | "skip_not_follower" | "skip_follower";

/** "Everyone" in a gated comment flow means: followers direct, non-followers follow first. */
function requiresFollow(rule: Pick<Rule, "require_follow" | "follower_condition">) {
  return rule.require_follow || rule.follower_condition === "any";
}

export function followVerdict(rule: Pick<Rule, "require_follow" | "follower_condition">, follows: boolean | null): FollowVerdict {
  // A postback is not guaranteed to grant profile consent. If Meta cannot
  // confirm the state, never hand out a follow-gated link by default.
  if (follows === null && requiresFollow(rule)) return "ask_follow";
  if (follows === false && requiresFollow(rule)) return "ask_follow";
  if (follows === false && rule.follower_condition === "followers_only") {
    return "skip_not_follower";
  }
  // Requiring a follow means both existing and newly confirmed followers get
  // the final DM. A legacy "non_followers" audience must not reject someone
  // who has already followed before tapping the opener.
  if (follows === true && requiresFollow(rule)) return "deliver";
  if (follows === true && rule.follower_condition === "non_followers") return "skip_follower";
  return "deliver";
}

/** A non-follower who was asked to follow remains eligible after doing so. */
export function followGateVerdict(
  rule: Pick<Rule, "require_follow" | "follower_condition">,
  follows: boolean | null,
  previousTaps: number,
): FollowVerdict {
  // A fresh opener and an "I followed" confirmation are separate stages:
  // only a verified follow may release the held link in either stage.
  if (follows === true && requiresFollow(rule)) return "deliver";
  if (follows !== true && requiresFollow(rule)) return "ask_follow";
  return followVerdict(rule, follows);
}

// ------------------------------------------------------------- delivery

type Button =
  | { type: "web_url"; url: string; title: string }
  | { type: "postback"; payload: string; title: string };

/**
 * Message shapes to try in order: a button template (supported by Messenger
 * and Instagram messaging), then quick replies for postback buttons, then
 * plain text with any links appended so the contact always gets something.
 */
function buttonMessages(text: string, buttons: Button[]): Record<string, unknown>[] {
  const body = text.slice(0, 640);
  const links = buttons
    .filter((b): b is Extract<Button, { type: "web_url" }> => b.type === "web_url")
    .map((b) => b.url);
  const postbacks = buttons.filter(
    (b): b is Extract<Button, { type: "postback" }> => b.type === "postback",
  );
  const withLinks = [body, ...links].join("\n");
  const shapes: Record<string, unknown>[] = [
    {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: body,
          buttons: buttons.slice(0, 3).map((b) => ({ ...b, title: b.title.slice(0, 20) })),
        },
      },
    },
  ];
  if (postbacks.length > 0) {
    shapes.push({
      text: withLinks,
      quick_replies: postbacks.map((b) => ({
        content_type: "text",
        title: b.title.slice(0, 20),
        payload: b.payload,
      })),
    });
  }
  shapes.push({ text: withLinks });
  return shapes;
}

/** A quick reply generates an inbound message, which grants profile consent;
 * a template postback alone does not always do so on Instagram. Never report
 * an opener as sent when it fell back to plain text without a tappable button. */
export function gateButtonMessages(
  text: string,
  buttons: Button[],
  preferQuickReply = true,
): Record<string, unknown>[] {
  const shapes = buttonMessages(text, buttons);
  const [template, quickReply] = shapes;
  if (!template) return [];
  if (!quickReply) return [template];
  return preferQuickReply ? [quickReply, template] : [template, quickReply];
}

/**
 * Opener shapes: 1) attached button template + quick reply (visible in the
 * bubble on every device and in Message Requests, quick reply kept for the
 * proven follower path), 2) attached template only, 3) quick reply only.
 */
export function openerMessages(text: string, title: string, payload: string) {
  const body = text.slice(0, 640);
  const t = title.slice(0, 20);
  const template = {
    attachment: {
      type: "template",
      payload: { template_type: "button", text: body, buttons: [{ type: "postback", title: t, payload }] },
    },
  };
  const quick = [{ content_type: "text", title: t, payload }];
  return [
    { ...template, quick_replies: quick },
    template,
    { text: body, quick_replies: quick },
  ] as Record<string, unknown>[];
}

/** Tries each message shape until the platform accepts one. */
async function sendChain(
  platform: AutomationContext["platform"],
  accountId: string,
  token: string,
  recipient: Record<string, unknown>,
  shapes: Record<string, unknown>[],
): Promise<{ id?: string | undefined; error?: string | undefined }> {
  const errors: string[] = [];
  for (const message of shapes) {
    const res = await callMessaging(platform, accountId, {
      recipient,
      message,
      access_token: token,
    });
    if (!res.error) return { id: res.id };
    errors.push(res.error);
  }
  return { error: errors.join(" | ") };
}

function attachmentOf(rule: Rule) {
  const url = (rule.dm_attachment_url ?? "").trim();
  const type = rule.dm_attachment_type;
  if (!url || !type || type === "none") return null;
  return { url, type };
}

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

/** Send the rule's DM: text with the link as a tappable button, then attachment. */
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
      return false;
    }
    const res = await call(`${GRAPH}/${ctx.externalId}/${ctx.platform === "facebook" ? "comments" : "replies"}`, {
      message: text,
      access_token: token,
    });
    if (res.error) {
      await log(admin, ctx, rule.id, "failed", res.error.slice(0, 300));
      return false;
    }
    await recordOutbound(admin, ctx, rule, `[public reply] ${text}`, res.id ?? null);
    await log(admin, ctx, rule.id, "sent", rule.action);
    return true;
  }

  if (rule.action !== "reply_dm" && rule.action !== "comment_private_reply") {
    await log(admin, ctx, rule.id, "skipped", "unknown_action");
    return false;
  }

  const link = (rule.dm_link_url ?? "").trim();
  const buttonLabel = (rule.dm_button_label ?? "").trim() || "Open link";
  const track = (k: "link" | "attachment", u: string) =>
    simulationStore.getStore()
      ? null
      : trackedUrl({ o: ctx.organizationId, r: rule.id, c: ctx.conversationId ?? null, k, u });
  const trackedLink = link ? track("link", link) : null;
  // Tracked button first; the original link shapes stay as a fallback so a
  // tracking problem can never block delivery.
  const shapes = link
    ? [
        ...(trackedLink
          ? buttonMessages(text, [{ type: "web_url", url: trackedLink, title: buttonLabel }])
          : []),
        ...buttonMessages(text, [{ type: "web_url", url: link, title: buttonLabel }]),
      ]
    : [{ text }];

  const recipient = actionRecipient(ctx, rule.action);
  const sent = await sendChain(ctx.platform, accountId, token, recipient, shapes);
  if (sent.error) {
    await log(admin, ctx, rule.id, "failed", sent.error.slice(0, 300));
    return false;
  }

  // Attachments need an open conversation: a private reply to a comment is a
  // single message, so they are only sent once the contact has messaged/tapped.
  const attachment = attachmentOf(rule);
  if (attachment) {
    if ("comment_id" in recipient) {
      await log(admin, ctx, rule.id, "skipped", "attachment_needs_tap");
    } else {
      const media = await callMessaging(ctx.platform, accountId, {
        recipient: { id: ctx.externalUserId },
        message: {
          attachment: {
            type: attachment.type,
            payload: { url: attachment.url, is_reusable: true },
          },
        },
        access_token: token,
      });
      if (media.error) {
        // Some file types are refused as native media — send the link instead.
        await callMessaging(ctx.platform, accountId, {
          recipient: { id: ctx.externalUserId },
          message: { text: track("attachment", attachment.url) ?? attachment.url },
          access_token: token,
        });
        await log(admin, ctx, rule.id, "failed", `attachment:${media.error.slice(0, 200)}`);
      }
    }
  }

  const prefix = rule.action === "comment_private_reply" ? "[private reply] " : "";
  const summary = link ? `${text}\n[${buttonLabel}] ${link}` : text;
  await recordOutbound(admin, ctx, rule, `${prefix}${summary}`, sent.id ?? null);
  await log(admin, ctx, rule.id, "sent", rule.action);
  return true;
}

// ------------------------------------------------------------- follow gate

/**
 * Instagram exposes whether the contact follows the business only after the
 * contact grants messaging-profile consent (sending a DM or tapping a postback
 * button). A comment alone does not grant it, so null means "Meta did not
 * reveal it", never "not following".
 */
async function checkFollows(
  platform: "instagram" | "facebook",
  externalUserId: string,
  token: string,
): Promise<boolean | null> {
  const sim = simulationStore.getStore();
  if (sim) return sim.follows;
  if (platform !== "instagram") return null;
  try {
    const path = `${externalUserId}?fields=is_user_follow_business&access_token=${encodeURIComponent(token)}`;
    const first = await readFollowState(`${GRAPH}/${path}`);
    if (typeof first.follows === "boolean") return first.follows;
    const retry = await readFollowState(`${IG_GRAPH}/${path}`);
    return typeof retry.follows === "boolean" ? retry.follows : null;
  } catch {
    return null;
  }
}

async function readFollowState(url: string): Promise<{
  follows?: boolean;
  errorCode?: number;
}> {
  const response = await fetch(url);
  const json = (await response.json()) as {
    is_user_follow_business?: boolean;
    error?: { code?: number };
  };
  if (response.ok && typeof json.is_user_follow_business === "boolean") {
    return { follows: json.is_user_follow_business };
  }
  return typeof json.error?.code === "number" ? { errorCode: json.error.code } : {};
}

const FOLLOW_PAYLOAD = "AUTOMATION_FOLLOW_CHECK";
const DEFAULT_FOLLOW_PROMPT =
  "Please follow us first so we can send you the details — then tap “I followed ✅” below.";
const OPENER_TEXT =
  "Thanks for your comment! 🙌 Tap the button below and I'll send it to you right here.";
/** One opener tap + three "I followed" checks. */
const MAX_GATE_TAPS = 4;

export function followGatePayload(gateId: string, stage: "opener" | "confirm", nonce: string) {
  return `${FOLLOW_PAYLOAD}:${gateId}:${stage}:${nonce}`;
}

/** Which gate stage a tap belongs to. Payload carries it; a text-only tap is
 * matched by exact button title ("I followed ✅" = confirmation). */
export function followGateStage(
  payload: string | null | undefined,
  messageText?: string | null,
): "opener" | "confirm" {
  if (payload && payload.startsWith(`${FOLLOW_PAYLOAD}:`)) {
    return payload.split(":")[2] === "confirm" ? "confirm" : "opener";
  }
  return (messageText ?? "").trim() === "I followed ✅" ? "confirm" : "opener";
}

async function profileUrlFor(admin: AdminClient, ctx: AutomationContext) {
  if (!ctx.socialAccountId) return null;
  const { data: acc } = await admin
    .from("social_accounts")
    .select("handle")
    .eq("id", ctx.socialAccountId)
    .maybeSingle();
  const handle = (acc?.handle ?? "").replace(/^@/, "").trim();
  if (!handle) return null;
  return ctx.platform === "instagram"
    ? `https://www.instagram.com/${handle}`
    : `https://www.facebook.com/${handle}`;
}

async function followPromptShapes(
  admin: AdminClient,
  ctx: AutomationContext,
  rule: Rule,
  gateId: string,
  retry: boolean,
) {
  const base = (rule.follow_prompt_text ?? "").trim() || DEFAULT_FOLLOW_PROMPT;
  const text = retry ? `We can't see your follow yet. ${base}` : base;
  const profileUrl = await profileUrlFor(admin, ctx);
  const buttons: Button[] = [];
  if (profileUrl) buttons.push({ type: "web_url", url: profileUrl, title: "Visit profile" });
  buttons.push({
    type: "postback",
    title: "I followed ✅",
    payload: followGatePayload(gateId, "confirm", crypto.randomUUID()),
  });
  // LOCKED: non-follower follow prompt sends attached buttons first (visible in
  // Message Requests), quick-reply shape kept only as fallback.
  return { text, shapes: gateButtonMessages(text, buttons, false) };
}

/**
 * Starts a gate. "opener" = one private reply to the comment with a postback
 * button; "follow" = the follow request (profile button + "I followed ✅").
 */
async function openGate(
  admin: AdminClient,
  ctx: AutomationContext,
  rule: Rule,
  token: string,
  accountId: string,
  stage: "opener" | "follow",
) {
  // A fresh comment supersedes older unanswered prompts for this contact and
  // account. This prevents an old button from competing with the current flow.
  let staleGateQuery = admin
    .from("automation_follow_gates")
    .update({ status: "expired" })
    .eq("organization_id", ctx.organizationId)
    .eq("platform", ctx.platform)
    .eq("external_user_id", ctx.externalUserId)
    .eq("status", "waiting");
  if (ctx.socialAccountId) staleGateQuery = staleGateQuery.eq("social_account_id", ctx.socialAccountId);
  const { data: staleGates } = await staleGateQuery.select("id, attempts");
  // Make silent drops visible: a previous button was never tapped (or Meta
  // never delivered the tap to us) before this new comment arrived.
  for (const g of staleGates ?? []) {
    await log(
      admin,
      ctx,
      rule.id,
      "skipped",
      g.attempts === 0 ? "gate:tap_never_received" : "gate:follow_confirm_never_received",
    );
  }

  const { data: gate, error: gateError } = await admin
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
      attempts: stage === "opener" ? 0 : 1,
    })
    .select("id")
    .single();

  if (gateError || !gate) {
    await log(admin, ctx, rule.id, "failed", `follow_gate:${gateError?.message ?? "not_created"}`);
    return;
  }

  let text: string;
  let shapes: Record<string, unknown>[];
  if (stage === "opener") {
    text = OPENER_TEXT;
    const title = (rule.dm_link_url ?? "").trim() ? "Send me the link" : "Send it to me";
    // LOCKED (follower flow verified in production): the quick-reply payload
    // is kept on the opener. We add an attached template button to the same
    // message so it stays visible in Message Requests (non-followers), where
    // bottom-of-screen quick replies are hidden. Fallbacks follow.
    shapes = openerMessages(text, title, followGatePayload(gate.id, "opener", crypto.randomUUID()));
    // Facebook only: last-resort plain text so a template refusal never
    // blocks the DM. Instagram shapes are unchanged (LOCKED). When the rule
    // requires a follow, the link must NOT ride along in the fallback text —
    // otherwise the plain-text shape would bypass the follow gate.
    if (ctx.platform === "facebook") {
      const link = (rule.dm_link_url ?? "").trim();
      const gated = requiresFollow(rule);
      shapes = [...shapes, { text: link && !gated ? `${OPENER_TEXT}\n${link}` : OPENER_TEXT }];
    }
  } else {
    ({ text, shapes } = await followPromptShapes(admin, ctx, rule, gate.id, false));
  }

  const res = await sendChain(
    ctx.platform,
    accountId,
    token,
    actionRecipient(ctx, rule.action),
    shapes,
  );
  const detail = stage === "opener" ? "tap_prompt" : "follow_prompt";
  if (res.error) {
    await admin.from("automation_follow_gates").update({ status: "expired" }).eq("id", gate.id);
    await log(admin, ctx, rule.id, "failed", `${detail}:${res.error.slice(0, 200)}`);
    return;
  }
  await recordOutbound(admin, ctx, rule, text, res.id ?? null);
  await log(admin, ctx, rule.id, "sent", detail);
}

/**
 * Called from the webhook when the contact taps a gate button (postback or
 * quick reply). The tap opens the conversation, so Meta now reveals the follow
 * state: followers get the DM with the link button + attachment, non-followers
 * get the follow request, and "I followed ✅" re-checks up to three times.
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
    messageText?: string | null;
    receivingExternalId?: string | null;
    correlationId?: string;
  },
) {
  const hasPayload = args.payload.startsWith(`${FOLLOW_PAYLOAD}:`);
  // Some Instagram quick replies arrive as plain message text without their
  // payload. Only resolve an exact button title against a gate for this sender;
  // never associate a text-only tap with another contact's pending comment.
  const isTextTap = !args.payload && ["Send me the link", "Send it to me", "I followed ✅"]
    .includes((args.messageText ?? "").trim());
  if (!hasPayload && !isTextTap) return false;
  // P2: during human takeover the tap is consumed without any automated send.
  if (await (await import("@/lib/human-takeover.server")).conversationInTakeover(admin, args.conversationId)) {
    await admin.from("automation_runs").insert({ organization_id: args.organizationId, rule_id: null, conversation_id: args.conversationId, status: "skipped", detail: "human_takeover" });
    return true;
  }
  // Payloads include stage and nonce. Always use the shared parser so the UUID
  // lookup never receives "<uuid>:opener:<nonce>".
  const gateId = hasPayload ? followGateId(args.payload) ?? "" : "";

  // The comment author id and the messaging sender id can differ, so a gate
  // referenced by the button payload is looked up by id alone.
  let query = admin
    .from("automation_follow_gates")
    .select("id, organization_id, rule_id, conversation_id, attempts, social_account_id, platform, external_user_id, created_at")
    .eq("status", "waiting");
  if (gateId) {
    query = query.eq("id", gateId);
  } else {
    query = query
      .eq("organization_id", args.organizationId)
      .eq("external_user_id", args.externalUserId)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    if (args.socialAccountId) query = query.eq("social_account_id", args.socialAccountId);
  }
  const { data: gates, error: gateLookupError } = await query
    .order("created_at", { ascending: false })
    .limit(1);
  if (gateLookupError) {
    await log(
      admin,
      { organizationId: args.organizationId, conversationId: args.conversationId } as AutomationContext,
      null,
      "failed",
      `gate_lookup:${gateLookupError.message.slice(0, 220)}`,
    );
    return true;
  }
  let gate = gates?.[0];
  // Facebook: the comment author id differs from the Messenger PSID, so a
  // text-only tap cannot match by sender. Use the single waiting Facebook gate
  // on this Page from the last 30 minutes — only when exactly one exists.
  if (!gate && !gateId && isTextTap && args.platform === "facebook" && args.socialAccountId) {
    const { data: fbGates } = await admin
      .from("automation_follow_gates")
      .select("id, organization_id, rule_id, conversation_id, attempts, social_account_id, platform, external_user_id, created_at")
      .eq("status", "waiting")
      .eq("platform", "facebook")
      .eq("organization_id", args.organizationId)
      .eq("social_account_id", args.socialAccountId)
      .gte("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .limit(2);
    if (fbGates && fbGates.length === 1) gate = fbGates[0];
  }
  // Never infer a text-only tap from another contact's waiting gate.
  if (!gate?.rule_id) {
    if (hasPayload) {
      await log(
        admin,
        { organizationId: args.organizationId, conversationId: args.conversationId } as AutomationContext,
        null,
        "skipped",
        "gate_not_found",
      );
    }
    return hasPayload; // never swallow an unrelated plain DM
  }

  const { data: rule } = await admin
    .from("automation_rules")
    .select(RULE_SELECT)
    .eq("id", gate.rule_id)
    .maybeSingle();
  if (!rule) {
    await log(admin, { organizationId: args.organizationId, conversationId: args.conversationId } as AutomationContext, null, "skipped", "gate_rule_missing");
    return true;
  }
  const typedRule = rule as unknown as Rule;

  const gateOrganizationId = gate.organization_id as string;
  const gateConversationId = (gate.conversation_id as string | null) ?? args.conversationId;
  const gatePlatform = gate.platform as "instagram" | "facebook";
  const socialAccountId = (gate.social_account_id as string | null) ?? args.socialAccountId;
  const ctx: AutomationContext = {
    organizationId: gateOrganizationId,
    conversationId: gateConversationId,
    socialAccountId,
    platform: gatePlatform,
    channel: "dm",
    body: "",
    externalUserId: args.externalUserId,
    externalId: null,
      ...(args.correlationId ? { correlationId: args.correlationId } : {}),
  };

  if (!socialAccountId) {
    await log(admin, ctx, typedRule.id, "failed", "no_account");
    return true;
  }
  const [{ data: tokenRow }, { data: account }] = await Promise.all([
    admin
      .from("social_account_tokens")
      .select("access_token")
      .eq("social_account_id", socialAccountId)
      .maybeSingle(),
    admin
      .from("social_accounts")
      .select("external_id, metadata")
      .eq("id", socialAccountId)
      .maybeSingle(),
  ]);
  const token = (await (await import("@/lib/token-crypto.server")).readToken(tokenRow?.access_token as string | undefined)) ?? undefined;
  if (!token || !account?.external_id) {
    await log(admin, ctx, typedRule.id, "failed", "no_token");
    return true;
  }
  const metadata = account.metadata as { page_id?: unknown } | null;
  const linkedPageId = typeof metadata?.page_id === "string" ? metadata.page_id : null;
  if (
    args.receivingExternalId &&
    args.receivingExternalId !== account.external_id &&
    args.receivingExternalId !== linkedPageId
  ) {
    await log(admin, ctx, typedRule.id, "failed", "gate_account_mismatch");
    return true;
  }
  const sendId = messagingAccountId(
    gatePlatform,
    account.external_id as string,
    account.metadata,
  );

  // Facebook: Messenger exposes no follow state and no Page-follow webhook, so
  // a required-follow rule runs on the honor system — the opener tap asks the
  // contact to follow (Visit profile + "I followed ✅") and the confirmation
  // tap delivers the final DM without re-checking. Instagram keeps its verified
  // Graph API check (LOCKED — never change this branch for Instagram).
  const tapStage = followGateStage(hasPayload ? args.payload : null, args.messageText);
  const follows = gatePlatform === "facebook"
    ? (tapStage === "confirm" || !requiresFollow(typedRule) ? true : null)
    : await checkFollows(gatePlatform, args.externalUserId, token);
  const previousTaps = (gate.attempts as number | null) ?? 0;
  const attempts = previousTaps + 1;
  const now = new Date().toISOString();
  // A required-follow flow delivers immediately for existing followers and
  // after confirmation for new followers, regardless of legacy audience filter.
  const verdict = followGateVerdict(typedRule, follows, previousTaps);
  await log(admin, ctx, typedRule.id, "matched", follows === true
    ? "gate_verified_follower"
    : follows === false
      ? "gate_verified_non_follower"
      : gatePlatform === "facebook" ? "gate_follow_prompt_pending" : "gate_follow_status_unavailable");

  const finish = (status: "completed" | "expired") =>
    admin
      .from("automation_follow_gates")
      .update({
        attempts,
        status,
        external_user_id: args.externalUserId,
        last_checked_at: now,
        completed_at: now,
      })
      .eq("id", gate.id);

  if (verdict === "skip_not_follower") {
    await finish("completed");
    await log(admin, ctx, typedRule.id, "skipped", "not_a_follower");
    return true;
  }
  if (verdict === "skip_follower") {
    await finish("completed");
    await log(admin, ctx, typedRule.id, "skipped", "already_a_follower");
    return true;
  }

  if (verdict === "ask_follow") {
    if (attempts >= MAX_GATE_TAPS) {
      await finish("expired");
      await log(admin, ctx, typedRule.id, "skipped", "follow_gate_expired");
      return true;
    }
    // Claim this tap atomically: the same tap can arrive via both the Page and
    // Instagram webhook objects, and only one copy may answer it.
    const { data: claimed } = await admin
      .from("automation_follow_gates")
      .update({ attempts, external_user_id: args.externalUserId, last_checked_at: now })
      .eq("id", gate.id)
      .eq("status", "waiting")
      .eq("attempts", previousTaps)
      .select("id");
    if (!claimed?.length) {
      await log(admin, ctx, typedRule.id, "skipped", "duplicate_tap");
      return true;
    }
    const isRetry = previousTaps >= 2;
    const { text, shapes } = await followPromptShapes(admin, ctx, typedRule, gate.id, isRetry);
    const res = await sendChain(gatePlatform, sendId, token, { id: args.externalUserId }, shapes);
    if (res.error) {
      await log(admin, ctx, typedRule.id, "failed", `follow_prompt:${res.error.slice(0, 200)}`);
      return true;
    }
    await recordOutbound(admin, ctx, typedRule, text, null);
    await log(
      admin,
      ctx,
      typedRule.id,
      isRetry ? "skipped" : "sent",
      isRetry ? "follow_not_confirmed" : follows === null ? "follow_status_unavailable" : "follow_prompt",
    );
    return true;
  }

  const { data: won } = await admin
    .from("automation_follow_gates")
    .update({
      attempts,
      status: "completed",
      external_user_id: args.externalUserId,
      last_checked_at: now,
      completed_at: now,
    })
    .eq("id", gate.id)
    .eq("status", "waiting")
    .select("id");
  if (!won?.length) {
    await log(admin, ctx, typedRule.id, "skipped", "duplicate_tap");
    return true;
  } // another copy of this tap already delivered
  // Never leave a tapped contact empty-handed when the DM text is blank.
  const text =
    pickResponse(typedRule) ||
    ((typedRule.dm_link_url ?? "").trim() ? "Here you go 👇" : "Thanks for following! 🙌");
  const delivered = await deliverDm(
    admin,
    ctx,
    { ...typedRule, action: "reply_dm" },
    token,
    sendId,
    text,
  );
  if (!delivered) {
    await admin
      .from("automation_follow_gates")
      .update({ status: "waiting", completed_at: null })
      .eq("id", gate.id)
      .eq("status", "completed")
      .eq("completed_at", now);
  }
  return true;
}

async function call(url: string, payload: Record<string, unknown>) {
  const sim = simulationStore.getStore();
  if (sim) {
    const clean = url.replace(/access_token=[^&]+/, "access_token=***");
    const { access_token: _omit, ...safe } = payload;
    void _omit;
    sim.calls.push({ url: clean, payload: safe });
    return { id: `sim_${sim.calls.length}` } as { id?: string; error?: string; errorCode?: number };
  }
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await response.json()) as {
    id?: string;
    message_id?: string;
    error?: { message?: string; code?: number; error_subcode?: number };
  };
  if (!response.ok || json.error) {
    return {
      error: [
        `HTTP ${response.status}`,
        json.error?.code != null ? `code ${json.error.code}` : null,
        json.error?.error_subcode != null ? `subcode ${json.error.error_subcode}` : null,
        json.error?.message,
      ].filter(Boolean).join(" · "),
      errorCode: json.error?.code,
    };
  }
  return { id: json.id ?? json.message_id };
}

/**
 * Instagram messaging through Facebook Login for Business is sent on the linked
 * Facebook Page id, not the IG user id — the IG id returns capability error #3.
 */
export function messagingAccountId(
  platform: AutomationContext["platform"],
  externalId: string,
  metadata: unknown,
): string {
  if (platform !== "instagram") return externalId;
  const pageId = (metadata as { page_id?: string } | null)?.page_id;
  return typeof pageId === "string" && pageId ? pageId : externalId;
}

/**
 * Sends a message, walking the host/id shapes Meta accepts: the Page id on
 * graph.facebook.com, the page-scoped "me" alias, and finally
 * graph.instagram.com for Instagram Business Login apps. Only capability error
 * #3 advances to the next shape; every other provider error is returned as is.
 */
async function callMessaging(
  platform: AutomationContext["platform"],
  accountId: string,
  payload: Record<string, unknown>,
) {
  const urls = [`${GRAPH}/${accountId}/messages`, `${GRAPH}/me/messages`];
  if (platform === "instagram") urls.push(`${IG_GRAPH}/${accountId}/messages`);

  let last = await call(urls[0]!, payload);
  for (const url of urls.slice(1)) {
    if (!last.error || last.errorCode !== 3) return last;
    last = await call(url, payload);
  }
  return last;
}

// Phase B live flows reuse the same safe sending helpers. Export-only: no
// behaviour of the locked rule engine changes.
export {
  call as flowGraphCall,
  callMessaging as flowCallMessaging,
  buttonMessages as flowButtonMessages,
  checkFollows as flowCheckFollows,
  inQuietHours as flowInQuietHours,
  hitsKeyword as flowHitsKeyword,
  DEFAULT_SETTINGS as FLOW_DEFAULT_SETTINGS,
};
export type { Settings as FlowSafetySettings };
