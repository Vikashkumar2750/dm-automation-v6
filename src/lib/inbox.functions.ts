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
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("conversations")
      .select(
        "id, organization_id, social_account_id, platform, external_user_id, external_user_name, channel, status, last_message_at, last_message_preview, unread_count",
      )
      .eq("organization_id", data.organizationId)
      .order("last_message_at", { ascending: false })
      .limit(100);
    if (data.platform) query = query.eq("platform", data.platform);
    if (data.channel) query = query.eq("channel", data.channel);
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
    const { data: allowed } = await context.supabase.rpc("has_org_role", {
      _org_id: conversation.organization_id,
      _user_id: context.userId,
      _roles: [...WRITE_ROLES],
    });
    if (!allowed) throw new Error("not_allowed");

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
        .select("external_id")
        .eq("id", conversation.social_account_id)
        .single(),
    ]);
    if (!tokenRow?.access_token || !account?.external_id) {
      throw new Error("no_token");
    }

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${account.external_id}/messages`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          recipient: { id: conversation.external_user_id },
          message: { text: data.body },
          access_token: tokenRow.access_token,
        }),
      },
    );
    const result = (await response.json()) as {
      message_id?: string;
      error?: { message?: string };
    };
    if (!response.ok || result.error) {
      throw new Error(result.error?.message ?? "Meta rejected the message");
    }

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

    return { ok: true };
  });
