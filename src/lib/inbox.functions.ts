import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SocialPlatform } from "@/lib/social";

export type ConversationRow = {
  id: string;
  organization_id: string;
  social_account_id: string | null;
  platform: SocialPlatform;
  external_user_id: string;
  external_user_name: string | null;
  channel: string;
  status: "open" | "pending" | "resolved";
  last_message_at: string;
  last_message_preview: string | null;
  unread_count: number;
  bot_paused_until?: string | null;
  bot_paused_by?: string | null;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  direction: "inbound" | "outbound";
  body: string;
  external_id: string | null;
  sender_name: string | null;
  sent_at: string;
  is_hidden: boolean;
};

const WRITE_ROLES = ["owner", "admin", "manager", "agent"] as const;

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        platform: z.enum(["instagram", "facebook", "youtube"]).optional(),
        channel: z.enum(["dm", "comment"]).optional(),
        status: z.enum(["open", "pending", "resolved"]).optional(),
        unreadOnly: z.boolean().optional(),
        search: z.string().trim().max(120).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("conversations")
      .select(
        "id, organization_id, social_account_id, platform, external_user_id, external_user_name, channel, status, last_message_at, last_message_preview, unread_count, bot_paused_until, bot_paused_by",
      )
      .eq("organization_id", data.organizationId)
      .order("last_message_at", { ascending: false })
      .limit(100);
    if (data.platform) query = query.eq("platform", data.platform);
    if (data.channel) query = query.eq("channel", data.channel);
    if (data.status) query = query.eq("status", data.status);
    if (data.unreadOnly) query = query.gt("unread_count", 0);
    if (data.search) {
      const term = data.search.replace(/[^\p{L}\p{N}\s@_'-]/gu, " ").trim();
      query = query.or(
        `external_user_name.ilike.%${term}%,last_message_preview.ilike.%${term}%`,
      );
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as ConversationRow[];
    const { fillSiblingNames } = await import("@/lib/contact-name");
    const missing = [...new Set(list.filter((r) => !r.external_user_name).map((r) => r.external_user_id))];
    if (!missing.length) return list;
    const { data: known } = await context.supabase
      .from("conversations")
      .select("platform, external_user_id, external_user_name")
      .eq("organization_id", data.organizationId)
      .in("external_user_id", missing.slice(0, 100))
      .not("external_user_name", "is", null)
      .limit(300);
    return fillSiblingNames(list, (known ?? []) as never);
  });

export const listMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ conversationId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const load = (cols: string) => context.supabase
      .from("messages")
      .select(cols)
      .eq("conversation_id", data.conversationId)
      .order("sent_at", { ascending: true })
      .limit(200);
    const base = "id, conversation_id, direction, body, external_id, sender_name, sent_at";
    let res = await load(`${base}, is_hidden`);
    // Older databases may not have is_hidden yet — fall back instead of showing an empty inbox.
    if (res.error && /is_hidden/.test(res.error.message)) res = await load(base);
    if (res.error) throw new Error(res.error.message);
    return ((res.data ?? []) as unknown as Partial<MessageRow>[]).map((m) => ({ ...m, is_hidden: !!m.is_hidden })) as MessageRow[];
  });

/** conversation id -> latest post the person commented on (display-only grouping). */
export const listCommentPostLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ conversationIds: z.array(z.string().uuid()).max(500) }).parse(data))
  .handler(async ({ data, context }) => {
    if (!data.conversationIds.length) return {} as Record<string, string>;
    const { data: rows, error } = await context.supabase
      .from("messages")
      .select("conversation_id, post_external_id, sent_at")
      .in("conversation_id", data.conversationIds)
      .not("post_external_id", "is", null)
      .order("sent_at", { ascending: false })
      .limit(2000);
    if (error) return {} as Record<string, string>;
    const out: Record<string, string> = {};
    for (const r of (rows ?? []) as Array<{ conversation_id: string; post_external_id: string | null }>) {
      if (r.post_external_id && !out[r.conversation_id]) out[r.conversation_id] = r.post_external_id;
    }
    return out;
  });

export const markConversationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ conversationId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("conversations")
      .update({ unread_count: 0 })
      .eq("id", data.conversationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setConversationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        conversationId: z.string().uuid(),
        status: z.enum(["open", "pending", "resolved"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("conversations")
      .update({ status: data.status })
      .eq("id", data.conversationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        conversationId: z.string().uuid(),
        body: z.string().trim().min(1).max(1000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    // Load the conversation (RLS proves org membership).
    const { data: conversation, error: convError } = await context.supabase
      .from("conversations")
      .select(
        "id, organization_id, social_account_id, platform, external_user_id, channel",
      )
      .eq("id", data.conversationId)
      .single();
    if (convError || !conversation) throw new Error("Conversation not found");

    // Only agents and above may send replies.
    const { data: allowed } = await context.supabase.rpc("current_user_has_org_role", {
      _org_id: conversation.organization_id,
      _roles: [...WRITE_ROLES],
    });
    if (!allowed) throw new Error("not_allowed");

    // Phase G: agents must use the approval queue when the workspace requires it.
    const [{ data: teamSettings }, { data: member }] = await Promise.all([
      context.supabase.from("team_settings").select("require_approval").eq("organization_id", conversation.organization_id).maybeSingle(),
      context.supabase.from("organization_members").select("role").eq("organization_id", conversation.organization_id).eq("user_id", context.userId).maybeSingle(),
    ]);
    if (teamSettings?.require_approval && member?.role === "agent") throw new Error("approval_required");

    if (conversation.channel !== "dm") {
      throw new Error("comment_unsupported");
    }
    if (conversation.platform === "youtube") {
      throw new Error("youtube_unsupported");
    }

    // Meta 24-hour standard messaging window: there must be an inbound
    // message from this user within the last 24 hours.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: lastInbound } = await context.supabase
      .from("messages")
      .select("sent_at")
      .eq("conversation_id", conversation.id)
      .eq("direction", "inbound")
      .gte("sent_at", since)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!lastInbound) throw new Error("window_expired");

    // Fetch the page/IG access token from the vault table (service role only).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!conversation.social_account_id) throw new Error("no_account");
    const [{ data: tokenRow }, { data: account }] = await Promise.all([
      supabaseAdmin
        .from("social_account_tokens")
        .select("access_token")
        .eq("social_account_id", conversation.social_account_id)
        .single(),
      supabaseAdmin
        .from("social_accounts")
        .select("external_id, metadata")
        .eq("id", conversation.social_account_id)
        .single(),
    ]);
    if (tokenRow?.access_token) tokenRow.access_token = (await (await import("@/lib/token-crypto.server")).readToken(tokenRow.access_token)) ?? "";
    if (!tokenRow?.access_token || !account?.external_id) {
      throw new Error("no_token");
    }

    const result = await sendMetaMessage(
      conversation.platform,
      account.external_id,
      account.metadata,
      {
        recipient: { id: conversation.external_user_id },
        message: { text: data.body },
        access_token: tokenRow.access_token,
      },
    );
    if (result.error) throw new Error(result.error);

    const now = new Date().toISOString();
    await supabaseAdmin.from("messages").insert({
      conversation_id: conversation.id,
      direction: "outbound",
      body: data.body,
      external_id: result.message_id ?? null,
      sent_by: context.userId,
      sent_at: now,
    });
    await supabaseAdmin
      .from("conversations")
      .update({
        last_message_at: now,
        last_message_preview: data.body.slice(0, 140),
        status: "pending",
      })
      .eq("id", conversation.id);
    // P2: a genuine manual reply hands the conversation to a human.
    await (await import("@/lib/human-takeover.server")).startTakeover(supabaseAdmin, { conversationId: conversation.id, organizationId: conversation.organization_id, userId: context.userId, reason: "manual_dm_reply" });

    return { ok: true };
  });

/**
 * Comment automation (Phase 6).
 * mode "public"  → posts a public reply under the comment.
 * mode "private" → sends a private DM triggered by the comment
 *                  (Meta allows one private reply per comment).
 */
export const replyToComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        conversationId: z.string().uuid(),
        body: z.string().trim().min(1).max(1000),
        mode: z.enum(["public", "private"]),
        commentMessageId: z.string().uuid().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: conversation, error: convError } = await context.supabase
      .from("conversations")
      .select("id, organization_id, social_account_id, platform, channel")
      .eq("id", data.conversationId)
      .single();
    if (convError || !conversation) throw new Error("Conversation not found");

    const { data: allowed } = await context.supabase.rpc("current_user_has_org_role", {
      _org_id: conversation.organization_id,
      _roles: [...WRITE_ROLES],
    });
    if (!allowed) throw new Error("not_allowed");

    if (conversation.channel !== "comment") throw new Error("not_a_comment");
    if (!conversation.social_account_id) throw new Error("no_account");

    // Latest inbound comment id — that is what we reply to.
    let commentQuery = context.supabase
      .from("messages")
      .select("external_id, sent_at")
      .eq("conversation_id", conversation.id)
      .eq("direction", "inbound");
    // Reply to the exact comment picked on the Comments page (one thread can span posts).
    if (data.commentMessageId) commentQuery = commentQuery.eq("id", data.commentMessageId);
    const { data: lastComment } = await commentQuery
      .not("external_id", "is", null)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!lastComment?.external_id) throw new Error("no_comment_id");

    if (conversation.platform === "youtube") {
      if (data.mode !== "public") throw new Error("youtube_public_only");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { freshYouTubeToken, postYouTubeReply } = await import(
        "@/lib/youtube-automation.server"
      );
      const token = await freshYouTubeToken(supabaseAdmin, conversation.social_account_id);
      if (!token) throw new Error("youtube_no_token");
      const result = await postYouTubeReply(lastComment.external_id, data.body, token);
      if (!result.ok) throw new Error(`youtube_reply: ${result.error}`);

      const now = new Date().toISOString();
      await supabaseAdmin.from("messages").insert({
        conversation_id: conversation.id,
        direction: "outbound",
        body: `[public reply] ${data.body}`,
        external_id: result.id,
        sent_by: context.userId,
        sent_at: now,
      });
      await supabaseAdmin
        .from("conversations")
        .update({
          last_message_at: now,
          last_message_preview: `[public reply] ${data.body}`.slice(0, 140),
          status: "pending",
        })
        .eq("id", conversation.id);
    await (await import("@/lib/human-takeover.server")).startTakeover(supabaseAdmin, { conversationId: conversation.id, organizationId: conversation.organization_id, userId: context.userId, reason: `manual_comment_${data.mode}` });
      return { ok: true };
    }

    // Meta's comment reply window is also 7 days for public / 7 days for private.
    const ageMs = Date.now() - new Date(lastComment.sent_at).getTime();
    if (ageMs > 7 * 24 * 60 * 60 * 1000) throw new Error("window_expired");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: tokenRow }, { data: account }] = await Promise.all([
      supabaseAdmin
        .from("social_account_tokens")
        .select("access_token")
        .eq("social_account_id", conversation.social_account_id)
        .single(),
      supabaseAdmin
        .from("social_accounts")
        .select("external_id, metadata")
        .eq("id", conversation.social_account_id)
        .single(),
    ]);
    if (tokenRow?.access_token) tokenRow.access_token = (await (await import("@/lib/token-crypto.server")).readToken(tokenRow.access_token)) ?? "";
    if (!tokenRow?.access_token || !account?.external_id) throw new Error("no_token");

    const accessToken = tokenRow.access_token;
    let result: { id?: string; message_id?: string; error?: string };

    if (data.mode === "private") {
      // Private reply: recipient is the comment itself.
      result = await sendMetaMessage(
        conversation.platform,
        account.external_id,
        account.metadata,
        {
          recipient: { comment_id: lastComment.external_id },
          message: { text: data.body },
          access_token: accessToken,
        },
      );
      // Meta allows only ONE private reply per comment. When the automation
      // already used it, message the person directly in the open DM thread.
      if (result.error) {
        const { data: conv } = await supabaseAdmin
          .from("conversations")
          .select("external_user_id")
          .eq("id", conversation.id)
          .single();
        if (conv?.external_user_id && !conv.external_user_id.startsWith("yt:")) {
          const direct = await sendMetaMessage(
            conversation.platform,
            account.external_id,
            account.metadata,
            {
              recipient: { id: conv.external_user_id },
              message: { text: data.body },
              access_token: accessToken,
            },
          );
          if (!direct.error) result = direct;
          else result = { error: `${result.error} | ${direct.error}` };
        }
      }
    } else {
      const edge = conversation.platform === "instagram" ? "replies" : "comments";
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${lastComment.external_id}/${edge}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: data.body, access_token: accessToken }),
        },
      );
      const json = (await response.json()) as {
        id?: string;
        error?: { message?: string };
      };
      result =
        !response.ok || json.error
          ? { error: json.error?.message ?? "Meta rejected the reply" }
          : { ...(json.id ? { id: json.id } : {}) };
    }
    if (result.error) throw new Error(result.error);

    const now = new Date().toISOString();
    const prefix = data.mode === "private" ? "[private reply] " : "[public reply] ";
    await supabaseAdmin.from("messages").insert({
      conversation_id: conversation.id,
      direction: "outbound",
      body: `${prefix}${data.body}`,
      external_id: result.id ?? result.message_id ?? null,
      sent_by: context.userId,
      sent_at: now,
    });
    await supabaseAdmin
      .from("conversations")
      .update({
        last_message_at: now,
        last_message_preview: `${prefix}${data.body}`.slice(0, 140),
        status: "pending",
      })
      .eq("id", conversation.id);

    return { ok: true };
  });

/** Hide or unhide a comment on Instagram/Facebook. */
export const setCommentHidden = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ conversationId: z.string().uuid(), hidden: z.boolean(), messageId: z.string().uuid().optional() })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; hidden?: boolean; error?: string }> => {
    try {
    const { data: conversation, error } = await context.supabase
      .from("conversations")
      .select("id, organization_id, social_account_id, channel, platform")
      .eq("id", data.conversationId)
      .single();
    if (error || !conversation) throw new Error("Conversation not found");
    if (conversation.channel !== "comment") throw new Error("not_a_comment");
    if (conversation.platform === "youtube") throw new Error("youtube_public_only");

    const { data: allowed } = await context.supabase.rpc("current_user_has_org_role", {
      _org_id: conversation.organization_id,
      _roles: [...WRITE_ROLES],
    });
    if (!allowed) throw new Error("not_allowed");
    if (!conversation.social_account_id) throw new Error("no_account");

    let commentQuery = context.supabase
      .from("messages")
      .select("external_id")
      .eq("conversation_id", conversation.id)
      .not("external_id", "is", null);
    commentQuery = data.messageId ? commentQuery.eq("id", data.messageId) : commentQuery.eq("direction", "inbound");
    const { data: lastComment } = await commentQuery
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!lastComment?.external_id) throw new Error("no_comment_id");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tokenRow } = await supabaseAdmin
      .from("social_account_tokens")
      .select("access_token")
      .eq("social_account_id", conversation.social_account_id)
      .single();
    if (tokenRow?.access_token) tokenRow.access_token = (await (await import("@/lib/token-crypto.server")).readToken(tokenRow.access_token)) ?? "";
    if (!tokenRow?.access_token) throw new Error("no_token");

    const { hiddenField, hideConfirmed } = await import("@/lib/comment-moderation");
    const commentUrl = `https://graph.facebook.com/v21.0/${encodeURIComponent(lastComment.external_id)}`;
    const response = await fetch(commentUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [hiddenField(conversation.platform)]: data.hidden, access_token: tokenRow.access_token }),
    });
    const result = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    if (!response.ok || result.error) {
      throw new Error(result.error?.message ?? "Meta rejected the request");
    }
    // Confirm on Meta itself so we never report "hidden" when nothing changed.
    const check = await fetch(`${commentUrl}?fields=id,${hiddenField(conversation.platform)}${conversation.platform === "facebook" ? ",can_hide" : ""}&access_token=${encodeURIComponent(tokenRow.access_token)}`)
      .then((r) => r.json() as Promise<Record<string, unknown>>).catch(() => null);
    if (!hideConfirmed(conversation.platform, check, data.hidden)) {
      if (check && check["can_hide"] === false) throw new Error("Facebook does not allow hiding this comment (the Page's own comments cannot be hidden).");
      throw new Error(`Meta accepted the request but the comment is still ${data.hidden ? "visible" : "hidden"}. Try again in a minute.`);
    }
    // Remember the confirmed state so Hide/Unhide survives a page refresh.
    if (data.messageId) {
      try { await supabaseAdmin.from("messages").update({ is_hidden: data.hidden }).eq("id", data.messageId); } catch { /* column may be missing */ }
    }
    return { ok: true, hidden: data.hidden };
    } catch (err) {
      // Return the reason instead of throwing so the screen shows the real cause.
      return { ok: false, error: err instanceof Error ? err.message : "Could not change comment visibility" };
    }
  });

/** Moderation targets a stored message, never an arbitrary caller-supplied Meta ID. */
export const moderateComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    conversationId: z.string().uuid(),
    messageId: z.string().uuid(),
    action: z.enum(["edit", "delete"]),
    body: z.string().trim().min(1).max(1000).optional(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: conversation, error } = await context.supabase.from("conversations")
      .select("id, organization_id, social_account_id, channel, platform")
      .eq("id", data.conversationId).single();
    if (error || !conversation) throw new Error("Conversation not found");
    if (conversation.channel !== "comment" || conversation.platform === "youtube") throw new Error("unsupported_comment_action");
    const { data: allowed } = await context.supabase.rpc("current_user_has_org_role", {
      _org_id: conversation.organization_id, _roles: [...WRITE_ROLES],
    });
    if (!allowed) throw new Error("not_allowed");
    const [{ data: teamSettings }, { data: member }] = await Promise.all([
      context.supabase.from("team_settings").select("require_approval").eq("organization_id", conversation.organization_id).maybeSingle(),
      context.supabase.from("organization_members").select("role").eq("organization_id", conversation.organization_id).eq("user_id", context.userId).maybeSingle(),
    ]);
    if (teamSettings?.require_approval && member?.role === "agent") throw new Error("approval_required");
    const { data: message } = await context.supabase.from("messages")
      .select("id, external_id, direction, body")
      .eq("id", data.messageId).eq("conversation_id", conversation.id).single();
    if (!message?.external_id || message.body === "[deleted comment]" ||
      (message.direction === "outbound" && !message.body.startsWith("[public reply] "))) throw new Error("no_comment_id");
    const { canEditComment, commentRequest } = await import("@/lib/comment-moderation");
    if (data.action === "edit" && !canEditComment(conversation.platform, message.direction, message.body, message.external_id)) throw new Error("comment_edit_unsupported");
    if (!conversation.social_account_id) throw new Error("no_account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tokenRow } = await supabaseAdmin.from("social_account_tokens")
      .select("access_token").eq("social_account_id", conversation.social_account_id).single();
    const { readToken } = await import("@/lib/token-crypto.server");
    const token = tokenRow?.access_token ? await readToken(tokenRow.access_token) : null;
    if (!token) throw new Error("no_token");
    const request = commentRequest(data.action, message.external_id, token, data.body);
    const response = await fetch(request.url, request.init);
    const result = await response.json().catch(() => ({})) as { success?: boolean; error?: { code?: number } } | boolean;
    if (!response.ok || result === false || (typeof result === "object" && (result.error || result.success === false))) {
      throw new Error("Meta could not complete this action. Check the comment still exists and the connected account has comment permissions.");
    }
    if (data.action === "delete") {
      const { deleteConfirmed } = await import("@/lib/comment-moderation");
      const check = await fetch(`${request.url}?fields=id&access_token=${encodeURIComponent(token)}`)
        .then((r) => r.json() as Promise<Record<string, unknown>>).catch(() => null);
      if (!deleteConfirmed(check)) throw new Error("Meta accepted the request but the comment still exists on the post. Try again in a minute.");
    }
    let saveError: { message: string } | null = null;
    if (data.action === "delete") {
      // Remove the comment and, for a user comment, the replies under it — Meta deletes those too.
      const ids = [message.id];
      if (message.direction === "inbound") {
        const { data: rest } = await supabaseAdmin.from("messages").select("id, direction, sent_at")
          .eq("conversation_id", conversation.id).order("sent_at", { ascending: true });
        const list = rest ?? [];
        const i = list.findIndex((r) => r.id === message.id);
        for (let j = i + 1; i >= 0 && j < list.length && list[j].direction !== "inbound"; j++) ids.push(list[j].id);
      }
      ({ error: saveError } = await supabaseAdmin.from("messages").delete().in("id", ids).eq("conversation_id", conversation.id));
    } else {
      ({ error: saveError } = await supabaseAdmin.from("messages").update({ body: `[public reply] ${data.body}` })
        .eq("id", message.id).eq("conversation_id", conversation.id));
    }
    if (saveError) throw new Error("Comment changed on Meta, but the inbox could not refresh. Reload before trying again.");
    const { data: latest } = await supabaseAdmin.from("messages").select("body")
      .eq("conversation_id", conversation.id).order("sent_at", { ascending: false }).limit(1).maybeSingle();
    if (latest) await supabaseAdmin.from("conversations").update({ last_message_preview: latest.body.slice(0, 140) }).eq("id", conversation.id);
    return { ok: true };
  });

/**
 * Sends a Messenger/Instagram message the same way the automation engine does:
 * Instagram messaging must go through the linked Facebook Page id (the IG user
 * id fails with capability error #3), so we try the page id first, then the
 * "me" alias, then the Instagram graph host — advancing only on error #3.
 */
async function sendMetaMessage(
  platform: string,
  externalId: string,
  metadata: unknown,
  payload: Record<string, unknown>,
): Promise<{ message_id?: string; error?: string }> {
  const pageId =
    (metadata as { page_id?: string; pageId?: string } | null)?.page_id ??
    (metadata as { pageId?: string } | null)?.pageId ??
    null;
  const ids = [pageId, externalId].filter((v): v is string => Boolean(v));
  const urls = [
    ...ids.map((id) => `https://graph.facebook.com/v21.0/${id}/messages`),
    "https://graph.facebook.com/v21.0/me/messages",
    ...(platform === "instagram"
      ? [`https://graph.instagram.com/v21.0/me/messages`]
      : []),
  ].filter((url, index, all) => all.indexOf(url) === index);

  let lastError = "Meta rejected the message";
  for (const url of urls) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await response.json().catch(() => ({}))) as {
      message_id?: string;
      error?: { message?: string; code?: number };
    };
    if (response.ok && !json.error) {
      return json.message_id ? { message_id: json.message_id } : {};
    }
    lastError = json.error?.message ?? `Meta error ${response.status}`;
    // Only a capability error means "wrong endpoint" — anything else is final.
    if (json.error?.code !== 3) return { error: lastError };
  }
  return { error: lastError };
}

/** P2: manually resume the bot (agents and above). Sends nothing by itself. */
export const resumeBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ conversationId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: conv } = await context.supabase.from("conversations").select("id, organization_id").eq("id", data.conversationId).maybeSingle();
    if (!conv) throw new Error("Conversation not found");
    const { data: allowed } = await context.supabase.rpc("current_user_has_org_role", { _org_id: conv.organization_id, _roles: [...WRITE_ROLES] });
    if (!allowed) throw new Error("not_allowed");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("conversations").update({ bot_paused_until: null, bot_paused_reason: "resumed" }).eq("id", conv.id);
    await supabaseAdmin.from("automation_runs").insert({ organization_id: conv.organization_id, rule_id: null, conversation_id: conv.id, status: "skipped", detail: "human_takeover:resumed" });
    return { ok: true };
  });
