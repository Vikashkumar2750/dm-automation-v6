/**
 * YouTube comment automation — fully isolated from the locked Instagram/Facebook
 * DM engine in `automation.server.ts`. YouTube has no webhooks and no direct
 * messaging API, so new comments are polled and answered with a public reply.
 *
 * Nothing in this file touches Meta code paths, tokens or tables used by the
 * Instagram/Facebook flows.
 */

type AdminClient = import("@supabase/supabase-js").SupabaseClient;

const YT = "https://www.googleapis.com/youtube/v3";
const LOOKBACK_MS = 48 * 60 * 60 * 1000;

type Rule = {
  id: string;
  name: string;
  platform: string | null;
  match_type: string;
  keywords: string[] | null;
  response_text: string | null;
  response_variations: string[] | null;
  comment_reply_text: string | null;
  comment_reply_variations: string[] | null;
  dm_link_url: string | null;
  target_post_ids: string[] | null;
  daily_limit: number;
  cooldown_seconds: number;
  priority: number;
};

const RULE_SELECT =
  "id, name, platform, match_type, keywords, response_text, response_variations, comment_reply_text, comment_reply_variations, dm_link_url, target_post_ids, daily_limit, cooldown_seconds, priority";

type Comment = {
  id: string;
  videoId: string | null;
  text: string;
  authorId: string | null;
  authorName: string | null;
  publishedAt: string;
};

function matches(rule: Rule, body: string) {
  if (rule.match_type === "any") return true;
  const text = body.toLowerCase().trim();
  const keys = (rule.keywords ?? []).map((k) => k.trim().toLowerCase()).filter(Boolean);
  if (keys.length === 0) return false;
  return keys.some((k) => {
    if (rule.match_type === "exact") return text === k;
    if (rule.match_type === "starts_with") return text.startsWith(k);
    return text.includes(k);
  });
}

function targetsVideo(rule: Rule, videoId: string | null) {
  const targets = (rule.target_post_ids ?? []).map((t) => t.trim()).filter(Boolean);
  if (targets.length === 0) return true;
  if (!videoId) return false;
  return targets.some((t) => t === videoId || videoId.endsWith(`_${t}`));
}

function pick(primary: string | null, variations: string[] | null | undefined) {
  const options = [primary, ...(variations ?? [])].map((t) => (t ?? "").trim()).filter(Boolean);
  if (options.length === 0) return null;
  return options[Math.floor(Math.random() * options.length)]!;
}

function replyText(rule: Rule) {
  const base = pick(rule.comment_reply_text, rule.comment_reply_variations) ??
    pick(rule.response_text, rule.response_variations);
  if (!base) return null;
  const link = (rule.dm_link_url ?? "").trim();
  if (link && !base.includes(link)) return `${base} ${link}`.slice(0, 900);
  return base.slice(0, 900);
}

/** Refresh the Google access token when it is close to expiring. */
async function freshToken(admin: AdminClient, accountId: string): Promise<string | null> {
  const { data } = await admin
    .from("social_account_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("social_account_id", accountId)
    .maybeSingle();
  const row = data as
    | { access_token?: string; refresh_token?: string | null; expires_at?: string | null }
    | null;
  if (!row?.access_token) return null;
  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  if (expiresAt > Date.now() + 120_000) return row.access_token;
  if (!row.refresh_token) return expiresAt ? null : row.access_token;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env["GOOGLE_OAUTH_CLIENT_ID"] ?? "",
      client_secret: process.env["GOOGLE_OAUTH_CLIENT_SECRET"] ?? "",
      refresh_token: row.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!json.access_token) return null;
  const expires = new Date(Date.now() + (json.expires_in ?? 3600) * 1000).toISOString();
  await admin
    .from("social_account_tokens")
    .update({ access_token: json.access_token, expires_at: expires })
    .eq("social_account_id", accountId);
  await admin.from("social_accounts").update({ token_expires_at: expires }).eq("id", accountId);
  return json.access_token;
}

async function fetchComments(channelId: string, token: string): Promise<Comment[]> {
  const url = `${YT}/commentThreads?part=snippet&allThreadsRelatedToChannelId=${encodeURIComponent(
    channelId,
  )}&maxResults=30&order=time`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  const json = (await res.json().catch(() => ({}))) as {
    items?: {
      snippet?: {
        topLevelComment?: {
          id?: string;
          snippet?: {
            videoId?: string;
            textOriginal?: string;
            textDisplay?: string;
            authorDisplayName?: string;
            authorChannelId?: { value?: string };
            publishedAt?: string;
          };
        };
      };
    }[];
    error?: { message?: string };
  };
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `YouTube refused the comment list (${res.status})`);
  }
  return (json.items ?? [])
    .map((item) => {
      const top = item.snippet?.topLevelComment;
      const s = top?.snippet;
      if (!top?.id || !s) return null;
      return {
        id: top.id,
        videoId: s.videoId ?? null,
        text: s.textOriginal ?? s.textDisplay ?? "",
        authorId: s.authorChannelId?.value ?? null,
        authorName: s.authorDisplayName ?? null,
        publishedAt: s.publishedAt ?? new Date().toISOString(),
      } satisfies Comment;
    })
    .filter((c): c is Comment => Boolean(c));
}

async function postReply(parentId: string, text: string, token: string) {
  const res = await fetch(`${YT}/comments?part=snippet`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ snippet: { parentId, textOriginal: text } }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    id?: string;
    error?: { message?: string };
  };
  if (!res.ok || json.error || !json.id) {
    return { ok: false as const, error: json.error?.message ?? `YouTube error ${res.status}` };
  }
  return { ok: true as const, id: json.id };
}

async function upsertConversation(
  admin: AdminClient,
  orgId: string,
  accountId: string,
  comment: Comment,
) {
  const externalUserId = comment.authorId ?? `yt:${comment.id}`;
  const { data: existing } = await admin
    .from("conversations")
    .select("id")
    .eq("organization_id", orgId)
    .eq("platform", "youtube")
    .eq("channel", "comment")
    .eq("external_user_id", externalUserId)
    .maybeSingle();
  if (existing?.id) return existing.id as string;
  const { data: created } = await admin
    .from("conversations")
    .insert({
      organization_id: orgId,
      social_account_id: accountId,
      platform: "youtube",
      channel: "comment",
      external_user_id: externalUserId,
      external_user_name: comment.authorName,
      status: "open",
      last_message_at: comment.publishedAt,
      last_message_preview: comment.text.slice(0, 140),
      unread_count: 1,
    })
    .select("id")
    .single();
  return (created?.id as string | undefined) ?? null;
}

async function log(
  admin: AdminClient,
  orgId: string,
  ruleId: string | null,
  conversationId: string | null,
  status: "matched" | "sent" | "skipped" | "failed",
  detail: string,
) {
  await admin.from("automation_runs").insert({
    organization_id: orgId,
    rule_id: ruleId,
    conversation_id: conversationId,
    status,
    detail,
  });
}

/** True unless a super admin turned YouTube comment automation off. */
export function youtubeAutomationEnabled(flags: unknown) {
  const value = (flags as { youtube_comment_automation?: unknown } | null)
    ?.youtube_comment_automation;
  return value !== false;
}

/**
 * Polls every connected YouTube channel for new top-level comments and sends
 * one public reply per comment, honouring the workspace pause switch, the rule
 * daily cap and a strict one-reply-per-comment guard.
 */
export async function runYouTubeCommentAutomation(
  admin: AdminClient,
  organizationId?: string,
): Promise<{ channels: number; comments: number; replied: number }> {
  const { data: platform } = await admin
    .from("platform_settings")
    .select("global_send_paused, feature_flags")
    .eq("id", true)
    .maybeSingle();
  if (platform?.global_send_paused) return { channels: 0, comments: 0, replied: 0 };
  if (!youtubeAutomationEnabled(platform?.feature_flags)) {
    return { channels: 0, comments: 0, replied: 0 };
  }

  let accountQuery = admin
    .from("social_accounts")
    .select("id, organization_id, external_id, name")
    .eq("platform", "youtube")
    .eq("status", "connected")
    .limit(50);
  if (organizationId) accountQuery = accountQuery.eq("organization_id", organizationId);
  const { data: accounts } = accountQuery as unknown as {
    data: { id: string; organization_id: string; external_id: string; name: string }[] | null;
  };
  const rows = (await accountQuery).data as
    | { id: string; organization_id: string; external_id: string; name: string }[]
    | null;
  void accounts;
  if (!rows || rows.length === 0) return { channels: 0, comments: 0, replied: 0 };

  let comments = 0;
  let replied = 0;

  for (const account of rows) {
    const token = await freshToken(admin, account.id);
    if (!token) {
      await log(admin, account.organization_id, null, null, "failed", "youtube:no_token");
      continue;
    }

    const { data: settings } = await admin
      .from("automation_settings")
      .select("is_paused, auto_paused_until")
      .eq("organization_id", account.organization_id)
      .maybeSingle();
    if (settings?.is_paused) continue;
    if (
      settings?.auto_paused_until &&
      new Date(settings.auto_paused_until as string).getTime() > Date.now()
    ) {
      continue;
    }

    const { data: ruleRows } = await admin
      .from("automation_rules")
      .select(RULE_SELECT)
      .eq("organization_id", account.organization_id)
      .eq("is_active", true)
      .eq("trigger", "comment_received")
      .in("platform", ["youtube"])
      .order("priority", { ascending: false });
    const { data: allPlatformRows } = await admin
      .from("automation_rules")
      .select(RULE_SELECT)
      .eq("organization_id", account.organization_id)
      .eq("is_active", true)
      .eq("trigger", "comment_received")
      .is("platform", null)
      .order("priority", { ascending: false });
    const rules = [
      ...((ruleRows ?? []) as Rule[]),
      ...((allPlatformRows ?? []) as Rule[]),
    ].sort((a, b) => b.priority - a.priority);
    if (rules.length === 0) continue;

    let fetched: Comment[] = [];
    try {
      fetched = await fetchComments(account.external_id, token);
    } catch (error) {
      await log(
        admin,
        account.organization_id,
        null,
        null,
        "failed",
        `youtube:comment_list: ${(error as Error).message}`.slice(0, 300),
      );
      continue;
    }

    for (const comment of fetched) {
      if (comment.authorId && comment.authorId === account.external_id) continue;
      if (Date.now() - new Date(comment.publishedAt).getTime() > LOOKBACK_MS) continue;
      comments += 1;

      // One reply per comment, ever.
      const { data: seen } = await admin
        .from("automation_runs")
        .select("id")
        .eq("organization_id", account.organization_id)
        .eq("detail", `youtube:comment:${comment.id}`)
        .limit(1)
        .maybeSingle();
      if (seen?.id) continue;

      const rule = rules.find(
        (r) => targetsVideo(r, comment.videoId) && matches(r, comment.text),
      );
      const conversationId = await upsertConversation(
        admin,
        account.organization_id,
        account.id,
        comment,
      );
      if (conversationId) {
        await admin.from("messages").insert({
          conversation_id: conversationId,
          direction: "inbound",
          body: comment.text.slice(0, 1000),
          external_id: comment.id,
          sender_name: comment.authorName,
          sent_at: comment.publishedAt,
        });
        await admin
          .from("conversations")
          .update({
            last_message_at: comment.publishedAt,
            last_message_preview: comment.text.slice(0, 140),
          })
          .eq("id", conversationId);
      }

      if (!rule) {
        await log(
          admin,
          account.organization_id,
          null,
          conversationId,
          "skipped",
          "youtube:no_matching_rule:keyword",
        );
        continue;
      }

      // Daily cap per rule.
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await admin
        .from("automation_runs")
        .select("id", { count: "exact", head: true })
        .eq("rule_id", rule.id)
        .eq("status", "sent")
        .gte("created_at", dayAgo);
      if ((count ?? 0) >= rule.daily_limit) {
        await log(
          admin,
          account.organization_id,
          rule.id,
          conversationId,
          "skipped",
          "youtube:daily_limit",
        );
        continue;
      }

      const text = replyText(rule);
      if (!text) {
        await log(
          admin,
          account.organization_id,
          rule.id,
          conversationId,
          "skipped",
          "youtube:no_response_text",
        );
        continue;
      }

      const result = await postReply(comment.id, text, token);
      if (!result.ok) {
        await log(
          admin,
          account.organization_id,
          rule.id,
          conversationId,
          "failed",
          `youtube:comment_reply: ${result.error}`.slice(0, 300),
        );
        continue;
      }

      replied += 1;
      await log(
        admin,
        account.organization_id,
        rule.id,
        conversationId,
        "sent",
        `youtube:comment:${comment.id}`,
      );
      if (conversationId) {
        const now = new Date().toISOString();
        await admin.from("messages").insert({
          conversation_id: conversationId,
          direction: "outbound",
          body: `[public reply] ${text}`,
          external_id: result.id,
          sent_at: now,
        });
        await admin
          .from("conversations")
          .update({
            last_message_at: now,
            last_message_preview: `[public reply] ${text}`.slice(0, 140),
            status: "pending",
          })
          .eq("id", conversationId);
      }
    }
  }

  return { channels: rows.length, comments, replied };
}
