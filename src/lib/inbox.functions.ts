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
      const term = data.search.replace(/[%,]/g, " ");
      query = query.or(
        `external_user_name.ilike.%${term}%,last_message_preview.ilike.%${term}%`,
      );
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []) as ConversationRow[];
  });

export const listMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ conversationId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("messages")
      .select("id, conversation_id, direction, body, external_id, sender_name, sent_at")
      .eq("conversation_id", data.conversationId)
      .order("sent_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    return (rows ?? []) as MessageRow[];
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
    const { data: lastComment } = await context.supabase
      .from("messages")
      .select("external_id, sent_at")
      .eq("conversation_id", conversation.id)
      .eq("direction", "inbound")
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
      .object({ conversationId: z.string().uuid(), hidden: z.boolean() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: conversation, error } = await context.supabase
      .from("conversations")
      .select("id, organization_id, social_account_id, channel")
      .eq("id", data.conversationId)
      .single();
    if (error || !conversation) throw new Error("Conversation not found");
    if (conversation.channel !== "comment") throw new Error("not_a_comment");

    const { data: allowed } = await context.supabase.rpc("current_user_has_org_role", {
      _org_id: conversation.organization_id,
      _roles: [...WRITE_ROLES],
    });
    if (!allowed) throw new Error("not_allowed");
    if (!conversation.social_account_id) throw new Error("no_account");

    const { data: lastComment } = await context.supabase
      .from("messages")
      .select("external_id")
      .eq("conversation_id", conversation.id)
      .eq("direction", "inbound")
      .not("external_id", "is", null)
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

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${lastComment.external_id}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          hide: data.hidden,
          access_token: tokenRow.access_token,
        }),
      },
    );
    const result = (await response.json()) as { error?: { message?: string } };
    if (!response.ok || result.error) {
      throw new Error(result.error?.message ?? "Meta rejected the request");
    }
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
