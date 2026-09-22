import { createFileRoute } from "@tanstack/react-router";

type MetaChange = {
  field?: string;
  value?: Record<string, unknown>;
};

type MetaEntry = {
  id?: string;
  time?: number;
  changes?: MetaChange[];
  messaging?: Array<Record<string, unknown>>;
};

type MetaPayload = {
  object?: string;
  entry?: MetaEntry[];
};

/** Constant-time compare of two hex signatures. */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacSha256Hex(secret: string, body: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function platformFor(object: string | undefined) {
  if (object === "instagram") return "instagram" as const;
  if (object === "page") return "facebook" as const;
  return null;
}

type MatchedAccount = {
  id: string;
  organization_id: string;
  platform: "instagram" | "facebook";
};

/**
 * Page feed webhooks carry the Facebook Page id even when the connected row is
 * an Instagram account. Fall back to the linked page_id stored at connection
 * time so Instagram comment events are not silently ignored.
 */
async function findSocialAccount(
  admin: AdminClient,
  externalId: string,
  payloadPlatform: "instagram" | "facebook",
): Promise<MatchedAccount | null> {
  const { data: exact } = await admin
    .from("social_accounts")
    .select("id, organization_id, platform")
    .eq("external_id", externalId)
    .eq("platform", payloadPlatform)
    .maybeSingle();
  if (exact) return exact as MatchedAccount;

  if (payloadPlatform !== "facebook") return null;
  const { data: linked } = await admin
    .from("social_accounts")
    .select("id, organization_id, platform")
    .eq("platform", "instagram")
    .contains("metadata", { page_id: externalId })
    .limit(1)
    .maybeSingle();
  return (linked as MatchedAccount | null) ?? null;
}

type AdminClient = import("@supabase/supabase-js").SupabaseClient;

type MessagingEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    quick_reply?: { payload?: string };
  };
  postback?: { payload?: string; title?: string; mid?: string };
};

type CommentValue = {
  item?: string;
  verb?: string;
  comment_id?: string;
  id?: string;
  text?: string;
  message?: string;
  post_id?: string;
  media?: { id?: string };
  post?: { id?: string };
  from?: { id?: string; username?: string; name?: string };
};

function eventIdentity(item: { type: string; value: unknown }, fallback: string) {
  const raw = item.value as {
    value?: CommentValue;
    comment_id?: string;
    id?: string;
    message?: { mid?: string };
    postback?: { mid?: string };
  };
  const comment = raw.value ?? raw;
  return (
    comment.comment_id ??
    comment.id ??
    raw.message?.mid ??
    raw.postback?.mid ??
    fallback
  );
}

/**
 * Mirror a webhook item into the inbox (conversations + messages).
 * DM events come from entry.messaging; comments arrive as changes.
 */
async function ingestIntoInbox(
  admin: AdminClient,
  args: {
    organizationId: string;
    socialAccountId: string | null;
    platform: "instagram" | "facebook";
    accountExternalId: string | null;
    type: string;
    value: unknown;
  },
) {
  const { organizationId, socialAccountId, platform, type, value } = args;

  let externalUserId: string | null = null;
  let externalUserName: string | null = null;
  let body: string | null = null;
  let externalId: string | null = null;
  let channel = "dm";
  let sentAt = new Date();
  let postExternalId: string | null = null;
  let followPayload: string | null = null;

  if (type.endsWith(".message") || type.endsWith(".messaging_postbacks")) {
    const m = value as MessagingEvent;
    if (m.message?.is_echo) return; // our own outbound echo
    externalUserId = m.sender?.id ?? null;
    if (!externalUserId || externalUserId === args.accountExternalId) return;
    followPayload = m.message?.quick_reply?.payload ?? m.postback?.payload ?? null;
    body = m.message?.text ?? m.postback?.title ?? null;
    externalId = m.message?.mid ?? m.postback?.mid ?? null;
    if (m.timestamp) sentAt = new Date(m.timestamp);
  } else if (type.endsWith(".comments") || type.endsWith(".feed")) {
    const c = (value as { value?: CommentValue }).value ?? (value as CommentValue);
    if (c.item && c.item !== "comment") return;
    if (c.verb === "remove") return;
    externalUserId = c.from?.id ?? null;
    if (!externalUserId || externalUserId === args.accountExternalId) return;
    externalUserName = c.from?.username ?? c.from?.name ?? null;
    body = c.text ?? c.message ?? null;
    externalId = c.comment_id ?? c.id ?? null;
    postExternalId = c.media?.id ?? c.post?.id ?? c.post_id ?? null;
    channel = "comment";
  } else {
    return;
  }

  if (!body) return;

  const { data: conversation, error: conversationError } = await admin
    .from("conversations")
    .upsert(
      {
        organization_id: organizationId,
        social_account_id: socialAccountId,
        platform,
        external_user_id: externalUserId,
        external_user_name: externalUserName,
        channel,
        status: "open",
        last_message_at: sentAt.toISOString(),
        last_message_preview: body.slice(0, 140),
      },
      { onConflict: "organization_id,platform,external_user_id,channel" },
    )
    .select("id")
    .single();

  if (conversationError || !conversation) {
    throw new Error(`conversation_upsert:${conversationError?.message ?? "no row returned"}`);
  }

  const { error: msgError } = await admin.from("messages").insert({
    conversation_id: conversation.id,
    direction: "inbound",
    body,
    external_id: externalId,
    sender_name: externalUserName,
    sent_at: sentAt.toISOString(),
  });
  // Duplicate external_id — already ingested.
  if (msgError && msgError.code !== "23505") {
    throw new Error(`message_insert:${msgError.message}`);
  }
  if (msgError) return;

  await admin.rpc("increment_unread", { p_conversation_id: conversation.id });

  // Automation engine (Phase 8) — evaluate rules for this inbound message.
  try {
    const { runAutomations, handleFollowGateReply } = await import(
      "@/lib/automation.server"
    );

    // "I followed" tap — verify the follow and release the held DM.
    if (followPayload) {
      const handled = await handleFollowGateReply(admin, {
        organizationId,
        conversationId: conversation.id,
        socialAccountId,
        platform,
        externalUserId,
        payload: followPayload,
      });
      if (handled) return;
    }

    await runAutomations(admin, {
      organizationId,
      conversationId: conversation.id,
      socialAccountId,
      platform,
      channel,
      body,
      externalUserId,
      externalId,
      postExternalId,
    });
  } catch (automationError) {
    console.error("automation run failed", automationError);
    throw automationError;
  }
}

export const Route = createFileRoute("/api/public/webhooks/meta")({
  server: {
    handlers: {
      // Meta's subscription verification handshake.
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge") ?? "";
        const expected = process.env["META_WEBHOOK_VERIFY_TOKEN"];

        if (mode === "subscribe" && expected && token === expected) {
          return new Response(challenge, {
            status: 200,
            headers: { "content-type": "text/plain" },
          });
        }
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        const body = await request.text();
        const appSecret = process.env["META_APP_SECRET"];
        const header = request.headers.get("x-hub-signature-256") ?? "";

        if (!appSecret) return new Response("Not configured", { status: 503 });

        const provided = header.startsWith("sha256=") ? header.slice(7) : "";
        const expected = await hmacSha256Hex(appSecret, body);
        if (!provided || !safeEqual(provided, expected)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: MetaPayload;
        try {
          payload = JSON.parse(body) as MetaPayload;
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        const payloadPlatform = platformFor(payload.object);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        for (const entry of payload.entry ?? []) {
          const externalId = entry.id ?? null;

          // Resolve which workspace this account belongs to (page id or IG user id).
          let organizationId: string | null = null;
          let socialAccountId: string | null = null;
          let platform = payloadPlatform;
          if (externalId && payloadPlatform) {
            const account = await findSocialAccount(
              supabaseAdmin,
              externalId,
              payloadPlatform,
            );
            organizationId = account?.organization_id ?? null;
            socialAccountId = account?.id ?? null;
            platform = account?.platform ?? payloadPlatform;
          }

          const items: Array<{ type: string; value: unknown }> = [
            ...(entry.changes ?? []).map((c) => ({
              type: `${payload.object ?? "meta"}.${c.field ?? "change"}`,
              value: c as unknown,
            })),
            ...(entry.messaging ?? []).map((m) => ({
              type: `${payload.object ?? "meta"}.message`,
              value: m as unknown,
            })),
          ];

          if (items.length === 0) {
            items.push({ type: `${payload.object ?? "meta"}.entry`, value: entry });
          }

          for (const [index, item] of items.entries()) {
            const identity = eventIdentity(item, `${entry.time ?? 0}:${index}`);
            const dedupeKey = `meta:${externalId ?? "unknown"}:${item.type}:${identity}`;
            const { data: webhookEvent, error } = await supabaseAdmin
              .from("webhook_events")
              .insert({
                provider: "meta",
                platform,
                organization_id: organizationId,
                social_account_id: socialAccountId,
                external_account_id: externalId,
                event_type: item.type,
                dedupe_key: dedupeKey,
                payload: item.value as never,
                signature_valid: true,
                status: organizationId ? "received" : "ignored",
                ...(organizationId ? {} : { error: "No connected account matched this id" }),
              })
              .select("id")
              .maybeSingle();
            // Duplicate delivery (Meta retries) — safe to skip.
            if (error && error.code !== "23505") console.error("webhook insert failed", error);

            // Mirror into the inbox (conversations/messages).
            if (organizationId && platform && webhookEvent?.id) {
              try {
                await ingestIntoInbox(supabaseAdmin, {
                  organizationId,
                  socialAccountId,
                  platform,
                  accountExternalId: externalId,
                  type: item.type,
                  value: item.value,
                });
                await supabaseAdmin
                  .from("webhook_events")
                  .update({ status: "processed", error: null })
                  .eq("id", webhookEvent.id);
              } catch (ingestError) {
                console.error("inbox ingest failed", ingestError);
                await supabaseAdmin
                  .from("webhook_events")
                  .update({
                    status: "failed",
                    error:
                      ingestError instanceof Error
                        ? ingestError.message.slice(0, 500)
                        : "Inbox or automation processing failed",
                  })
                  .eq("id", webhookEvent.id);
              }
            }
          }
        }

        // Always 200 quickly so Meta does not retry storm.
        return new Response("EVENT_RECEIVED", { status: 200 });
      },
    },
  },
});
