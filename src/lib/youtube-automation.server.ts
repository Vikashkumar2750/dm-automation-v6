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
const VIDEO_BATCH_SIZE = 20;
const MAX_CHANNEL_VIDEOS = 500;
const MAX_COMMENTS_PER_VIDEO = 500;

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

/**
 * YouTube has no direct messages. Rules are often copied from the Instagram /
 * Facebook DM flow, so any "check your DM" wording must be stripped before a
 * reply is published publicly under a video.
 */
const DM_PHRASES =
  /\b(replied|reply|answered|sent|sending|check|dekho|dekhein)?\s*(you)?\s*(in|on|your|the)?\s*(dm|dms|inbox|direct message|private message|messenger)\b[^.!?]*/gi;

export function stripDmWording(text: string): string {
  return text
    .replace(DM_PHRASES, " ")
    .replace(/\b(dm|dms|inbox)\b/gi, " ")
    .replace(/\s*[📩📨✉️📬]\s*/g, " ")
    .replace(/\s*([.!?])\s*\1+/g, "$1")
    .replace(/^[\s,.!?–—-]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function replyText(rule: Rule) {
  const base = pick(rule.comment_reply_text, rule.comment_reply_variations) ??
    pick(rule.response_text, rule.response_variations);
  if (!base) return null;
  const safe = stripDmWording(base);
  if (!safe) return null;
  const link = (rule.dm_link_url ?? "").trim();
  if (link && !safe.includes(link)) return `${safe} ${link}`.slice(0, 900);
  return safe.slice(0, 900);
}

/**
 * Context-aware reply used when no AI provider is available. Detects intent in
 * English, Hindi and Hinglish so the reply still relates to the comment.
 */
export function fallbackYouTubeReply(comment: string, rule: Rule): string {
  const text = comment.toLowerCase().trim();
  const link = (rule.dm_link_url ?? "").trim();
  const withLink = (body: string) => (link ? `${body} ${link}`.slice(0, 900) : body);

  if (/\?|how|where|when|what|which|price|cost|kaise|kahan|kab|kitna|kya|batao|bataye/.test(text)) {
    return withLink(
      "Great question — thanks for asking! We have covered this in detail and will keep sharing more on it.",
    );
  }
  if (/mast|badhiya|bahut accha|bohot accha|shandar|zabardast|kya baat|maza aa/.test(text)) {
    return withLink("Bahut shukriya! Khushi hui ki aapko video pasand aayi 🙏");
  }
  if (/thank|thanks|shukriya|dhanyavad|helpful|useful|learn/.test(text)) {
    return withLink("Thank you — really glad this was useful for you!");
  }
  if (/great|amazing|love|nice|awesome|superb|best|wow|op|fire|excellent|good/.test(text)) {
    return withLink("Thanks a lot for the kind words — glad you enjoyed it!");
  }
  if (/not work|problem|issue|error|nahi ho|nahi chal|doubt|stuck|help/.test(text)) {
    return withLink(
      "Sorry you hit that — tell us a bit more about what happened and we will help you sort it out.",
    );
  }
  const configured = replyText(rule);
  if (configured) return configured;
  return withLink("Thanks for watching and for taking the time to comment — it really means a lot!");
}

async function smartReply(
  admin: AdminClient,
  comment: Comment,
  rule: Rule,
  aiPaused: boolean,
  orgId: string,
): Promise<{ text: string; usedAi: boolean }> {
  const fallback = fallbackYouTubeReply(comment.text, rule);
  if (aiPaused) return { text: fallback, usedAi: false };
  try {
    const { generateYouTubeReply } = await import("@/lib/youtube-ai.server");
    const generated = await generateYouTubeReply(admin, {
      comment: comment.text,
      approvedReply: replyText(rule),
      link: rule.dm_link_url,
      scope: `youtube:${orgId}`,
    });
    if (!generated.text) return { text: fallback, usedAi: false };
    const safe = stripDmWording(generated.text) || generated.text;
    const link = (rule.dm_link_url ?? "").trim();
    const withLink = link && !safe.includes(link) ? `${safe} ${link}` : safe;
    return { text: withLink.slice(0, 900), usedAi: true };
  } catch {
    return { text: fallback, usedAi: false };
  }
}

/** Refresh the Google access token when it is close to expiring. */
export async function freshYouTubeToken(
  admin: AdminClient,
  accountId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("social_account_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("social_account_id", accountId)
    .maybeSingle();
  const row = data as
    | { access_token?: string; refresh_token?: string | null; expires_at?: string | null }
    | null;
  if (!row?.access_token) {
    await admin.from("social_accounts").update({ status: "attention" }).eq("id", accountId);
    return null;
  }
  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  if (expiresAt > Date.now() + 120_000) return row.access_token;
  if (!row.refresh_token) {
    if (expiresAt) {
      await admin.from("social_accounts").update({ status: "attention" }).eq("id", accountId);
      return null;
    }
    return row.access_token;
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env["GOOGLE_OAUTH_CLIENT_ID"] ?? process.env["YOUTUBE_CLIENT_ID"] ?? "",
      client_secret:
        process.env["GOOGLE_OAUTH_CLIENT_SECRET"] ?? process.env["YOUTUBE_CLIENT_SECRET"] ?? "",
      refresh_token: row.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!json.access_token) {
    await admin.from("social_accounts").update({ status: "attention" }).eq("id", accountId);
    return null;
  }
  const expires = new Date(Date.now() + (json.expires_in ?? 3600) * 1000).toISOString();
  await admin
    .from("social_account_tokens")
    .update({ access_token: json.access_token, expires_at: expires })
    .eq("social_account_id", accountId);
  await admin
    .from("social_accounts")
    .update({ token_expires_at: expires, status: "connected" })
    .eq("id", accountId);
  return json.access_token;
}

/** Uploaded video ids, paginated so older videos are eventually checked too. */
async function uploadedVideoIds(channelId: string, token: string): Promise<string[]> {
  const auth = { headers: { authorization: `Bearer ${token}` } };
  const ch = (await (
    await fetch(`${YT}/channels?part=contentDetails&id=${encodeURIComponent(channelId)}`, auth)
  ).json().catch(() => ({}))) as {
    items?: { contentDetails?: { relatedPlaylists?: { uploads?: string } } }[];
  };
  const uploads = ch.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) return [];
  const videos: string[] = [];
  let pageToken: string | null = null;
  do {
    const params = new URLSearchParams({
      part: "contentDetails",
      maxResults: "50",
      playlistId: uploads,
      ...(pageToken ? { pageToken } : {}),
    });
    const response = await fetch(`${YT}/playlistItems?${params}`, auth);
    const json = (await response.json().catch(() => ({}))) as {
      items?: { contentDetails?: { videoId?: string } }[];
      nextPageToken?: string;
    };
    if (!response.ok) break;
    videos.push(
      ...(json.items ?? [])
        .map((item) => item.contentDetails?.videoId)
        .filter((videoId): videoId is string => Boolean(videoId)),
    );
    pageToken = json.nextPageToken ?? null;
  } while (pageToken && videos.length < MAX_CHANNEL_VIDEOS);
  return videos.slice(0, MAX_CHANNEL_VIDEOS);
}

export function videosForPoll(videos: string[], cursor: number): { ids: string[]; next: number } {
  if (videos.length <= VIDEO_BATCH_SIZE) return { ids: videos, next: 0 };
  const recent = videos.slice(0, 10);
  const start = Math.max(10, cursor < 10 ? 10 : cursor);
  const rotating = videos.slice(start, start + 10);
  const next = start + 10 >= videos.length ? 10 : start + 10;
  return { ids: [...new Set([...recent, ...rotating])], next };
}

async function fetchComments(
  channelId: string,
  token: string,
  cursor: number,
): Promise<{ comments: Comment[]; nextCursor: number; disabled: string[] }> {
  const videos = await uploadedVideoIds(channelId, token);
  const poll = videosForPoll(videos, cursor);
  const all: Comment[] = [];
  const disabled: string[] = [];
  let lastError: Error | null = null;
  for (const videoId of poll.ids) {
    try {
      all.push(...(await fetchVideoComments(videoId, token)));
    } catch (e) {
      const error = e as Error & { reason?: string };
      if (error.reason === "commentsDisabled") disabled.push(videoId);
      else lastError = error;
    }
  }
  if (all.length === 0 && lastError && disabled.length === 0) throw lastError;
  return { comments: all, nextCursor: poll.next, disabled };
}

async function fetchVideoComments(videoId: string, token: string): Promise<Comment[]> {
  const comments: Comment[] = [];
  let pageToken: string | null = null;
  do {
    const params = new URLSearchParams({
      part: "snippet",
      videoId,
      maxResults: "100",
      order: "time",
      ...(pageToken ? { pageToken } : {}),
    });
    const res = await fetch(`${YT}/commentThreads?${params}`, {
      headers: { authorization: `Bearer ${token}` },
    });
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
      nextPageToken?: string;
      error?: { message?: string; errors?: Array<{ reason?: string }> };
    };
    if (!res.ok || json.error) {
      const error = new Error(
        json.error?.message ?? `YouTube refused the comment list (${res.status})`,
      ) as Error & { reason?: string };
      const reason = youtubeApiReason(json);
      if (reason) error.reason = reason;
      throw error;
    }
    comments.push(
      ...(json.items ?? [])
        .map((item) => {
          const top = item.snippet?.topLevelComment;
          const snippet = top?.snippet;
          if (!top?.id || !snippet) return null;
          return {
            id: top.id,
            videoId: snippet.videoId ?? null,
            text: snippet.textOriginal ?? snippet.textDisplay ?? "",
            authorId: snippet.authorChannelId?.value ?? null,
            authorName: snippet.authorDisplayName ?? null,
            publishedAt: snippet.publishedAt ?? new Date().toISOString(),
          } satisfies Comment;
        })
        .filter((comment): comment is Comment => Boolean(comment)),
    );
    pageToken = json.nextPageToken ?? null;
  } while (pageToken && comments.length < MAX_COMMENTS_PER_VIDEO);
  return comments.slice(0, MAX_COMMENTS_PER_VIDEO);
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

export async function postYouTubeReply(parentId: string, text: string, token: string) {
  return postReply(parentId, text, token);
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
    .select("id, last_message_at")
    .eq("organization_id", orgId)
    .eq("platform", "youtube")
    .eq("channel", "comment")
    .eq("external_user_id", externalUserId)
    .maybeSingle();
  if (existing?.id) {
    if (comment.publishedAt >= existing.last_message_at) {
      await admin
        .from("conversations")
        .update({
          social_account_id: accountId,
          external_user_name: comment.authorName,
          last_message_at: comment.publishedAt,
          last_message_preview: comment.text.slice(0, 140),
        })
        .eq("id", existing.id);
    }
    return { id: existing.id as string, created: false };
  }
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
  return created?.id ? { id: created.id as string, created: true } : null;
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

async function logOnce(
  admin: AdminClient,
  orgId: string,
  ruleId: string | null,
  conversationId: string | null,
  status: "matched" | "sent" | "skipped" | "failed",
  detail: string,
) {
  const { data } = await admin
    .from("automation_runs")
    .select("id")
    .eq("organization_id", orgId)
    .eq("detail", detail)
    .limit(1)
    .maybeSingle();
  if (!data?.id) await log(admin, orgId, ruleId, conversationId, status, detail);
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
  const globalSendPaused = platform?.global_send_paused === true;
  const automationEnabled = youtubeAutomationEnabled(platform?.feature_flags);
  const aiPaused =
    ((platform?.feature_flags ?? {}) as Record<string, unknown>)["youtube_ai_paused"] === true;

  let accountQuery = admin
    .from("social_accounts")
    .select("id, organization_id, external_id, name, metadata")
    .eq("platform", "youtube")
    .eq("status", "connected")
    .limit(50);
  if (organizationId) accountQuery = accountQuery.eq("organization_id", organizationId);
  const rows = (await accountQuery).data as
    | {
        id: string;
        organization_id: string;
        external_id: string;
        name: string;
        metadata: Record<string, unknown> | null;
      }[]
    | null;
  if (!rows || rows.length === 0) return { channels: 0, comments: 0, replied: 0 };

  let comments = 0;
  let replied = 0;

  for (const account of rows) {
    const token = await freshYouTubeToken(admin, account.id);
    if (!token) {
      await log(admin, account.organization_id, null, null, "failed", "youtube:no_token");
      continue;
    }

    const { data: settings } = await admin
      .from("automation_settings")
      .select("is_paused, auto_paused_until")
      .eq("organization_id", account.organization_id)
      .maybeSingle();
    const workspaceSendPaused =
      settings?.is_paused === true ||
      Boolean(
        settings?.auto_paused_until &&
          new Date(settings.auto_paused_until as string).getTime() > Date.now(),
      );

    const { data: ruleRows } = await admin
      .from("automation_rules")
      .select(RULE_SELECT)
      .eq("organization_id", account.organization_id)
      .eq("is_active", true)
      .eq("trigger", "comment_received")
      .in("platform", ["youtube"])
      .order("priority", { ascending: false });
    // "Both platforms" rules are Facebook + Instagram only — never YouTube.
    const rules = ((ruleRows ?? []) as Rule[]).sort((a, b) => b.priority - a.priority);
    let fetched: Comment[] = [];
    const cursor = Number(account.metadata?.["youtube_poll_cursor"] ?? 10);
    try {
      const result = await fetchComments(account.external_id, token, cursor);
      fetched = result.comments;
      await admin
        .from("social_accounts")
        .update({
          last_synced_at: new Date().toISOString(),
          metadata: { ...(account.metadata ?? {}), youtube_poll_cursor: result.nextCursor },
        })
        .eq("id", account.id);
      for (const videoId of result.disabled) {
        const day = new Date().toISOString().slice(0, 10);
        await logOnce(
          admin,
          account.organization_id,
          null,
          null,
          "skipped",
          `youtube:comments_disabled:${videoId}:${day}`,
        );
      }
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
      const eligibleForAutomation =
        Date.now() - new Date(comment.publishedAt).getTime() <= LOOKBACK_MS;
      comments += 1;

      const rule = rules.find(
        (r) => targetsVideo(r, comment.videoId) && matches(r, comment.text),
      );
      const conversation = await upsertConversation(
        admin,
        account.organization_id,
        account.id,
        comment,
      );
      const conversationId = conversation?.id ?? null;
      if (conversationId) {
        const { data: existingMessage } = await admin
          .from("messages")
          .select("id")
          .eq("conversation_id", conversationId)
          .eq("external_id", comment.id)
          .maybeSingle();
        if (!existingMessage?.id) {
          await admin.from("messages").insert({
          conversation_id: conversationId,
          direction: "inbound",
          body: comment.text.slice(0, 1000),
          external_id: comment.id,
          sender_name: comment.authorName,
          sent_at: comment.publishedAt,
          });
          if (!conversation?.created) {
            await admin.rpc("increment_unread", { p_conversation_id: conversationId });
          }
        }
      }

      if (comment.authorId && comment.authorId === account.external_id) {
        await logOnce(
          admin,
          account.organization_id,
          null,
          conversationId,
          "skipped",
          `youtube:own_channel_comment:${comment.id}`,
        );
        continue;
      }

      // One automatic reply per comment, ever. Inbox ingestion above still runs.
      const { data: seen } = await admin
        .from("automation_runs")
        .select("id")
        .eq("organization_id", account.organization_id)
        .like("detail", `youtube:comment:${comment.id}%`)
        .limit(1)
        .maybeSingle();
      if (seen?.id) continue;

      if (!rule) {
        await logOnce(
          admin,
          account.organization_id,
          null,
          conversationId,
          "skipped",
          `youtube:no_matching_rule:keyword:${comment.id}`,
        );
        continue;
      }

      if (!eligibleForAutomation) continue;
      if (globalSendPaused || !automationEnabled || workspaceSendPaused) continue;

      if (comment.authorId && comment.videoId && rule.cooldown_seconds > 0) {
        const since = new Date(Date.now() - rule.cooldown_seconds * 1000).toISOString();
        const { data: recentReply } = await admin
          .from("automation_runs")
          .select("id")
          .eq("organization_id", account.organization_id)
          .eq("rule_id", rule.id)
          .eq("status", "sent")
          .like("detail", `%:video:${comment.videoId}:author:${comment.authorId}`)
          .gte("created_at", since)
          .limit(1)
          .maybeSingle();
        if (recentReply?.id) {
          await logOnce(
            admin,
            account.organization_id,
            rule.id,
            conversationId,
            "skipped",
            `youtube:contact_cooldown:${comment.id}`,
          );
          continue;
        }
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

      const reply = await smartReply(admin, comment, rule, aiPaused);
      const text = reply.text;

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
      if (!reply.usedAi) {
        await logOnce(
          admin,
          account.organization_id,
          rule.id,
          conversationId,
          "matched",
          `youtube:ai_fallback:${comment.id}`,
        );
      }
      await log(
        admin,
        account.organization_id,
        rule.id,
        conversationId,
        "sent",
        `youtube:comment:${comment.id}:video:${comment.videoId ?? "unknown"}:author:${comment.authorId ?? "unknown"}`,
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
