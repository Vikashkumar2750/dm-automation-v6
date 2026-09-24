import { createFileRoute } from "@tanstack/react-router";
import {
  followGateId,
  isMessagingEventType,
  messagingContent,
  normalizeMessagingEvent,
} from "@/lib/meta-messaging";

type MetaChange = {
  field?: string;
  value?: Record<string, unknown>;
};

type MetaEntry = {
  id?: string;
  time?: number;
  changes?: MetaChange[];
  messaging?: Array<Record<string, unknown>>;
  /** Taps from message requests (non-followers) can arrive on the standby channel. */
  standby?: Array<Record<string, unknown>>;
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

type GateAccount = MatchedAccount & {
  external_id: string;
  metadata: unknown;
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

/** A button payload is an unforgeable reference to the saved gate. Use the
 * gate's original Instagram account instead of an exact Facebook Page row. */
async function findGateAccount(
  admin: AdminClient,
  gateId: string,
  receivingExternalId: string | null,
): Promise<GateAccount | null> {
  const { data: gate } = await admin
    .from("automation_follow_gates")
    .select("social_account_id")
    .eq("id", gateId)
    .eq("status", "waiting")
    .maybeSingle();
  if (!gate?.social_account_id) return null;

  const { data: account } = await admin
    .from("social_accounts")
    .select("id, organization_id, platform, external_id, metadata")
    .eq("id", gate.social_account_id)
    .maybeSingle();
  if (!account || account.platform === "youtube") return null;
  const metadata = account.metadata as { page_id?: unknown } | null;
  const pageId = typeof metadata?.page_id === "string" ? metadata.page_id : null;
  if (
    receivingExternalId &&
    receivingExternalId !== account.external_id &&
    receivingExternalId !== pageId
  ) return null;
  return account as GateAccount;
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
  if (isMessagingEventType(item.type)) {
    const event = normalizeMessagingEvent(item.value);
    const content = messagingContent(event);
    if (content.externalId) return content.externalId;
    if (content.payload) return `tap:${content.payload}:${event.timestamp ?? fallback}`;
  }
  const raw = item.value as {
    value?: CommentValue;
    comment_id?: string;
    id?: string;
    timestamp?: number;
    message?: { mid?: string };
    postback?: { mid?: string; payload?: string };
  };
  // Each tap is its own event even when Instagram repeats the button's mid.
  if (raw.postback) {
    return `postback:${raw.postback.mid ?? ""}:${raw.postback.payload ?? ""}:${raw.timestamp ?? fallback}`;
  }
  const comment = raw.value ?? raw;
  return comment.comment_id ?? comment.id ?? raw.message?.mid ?? fallback;
}

/**
 * Mirror a webhook item into the inbox (conversations + messages).
 * DM events come from entry.messaging; comments arrive as changes.
 * Returns a short trace code whenever the item is skipped so the webhook
 * event row shows exactly why no automation ran for it.
 */
async function ingestIntoInbox(
  admin: AdminClient,
  args: {
    organizationId: string;
    socialAccountId: string | null;
    platform: "instagram" | "facebook";
    accountExternalId: string | null;
    receivingExternalId: string | null;
    type: string;
    value: unknown;
  },
): Promise<string | null> {
  let { organizationId, socialAccountId, platform } = args;
  const { type, value } = args;

  let externalUserId: string | null = null;
  let externalUserName: string | null = null;
  let body: string | null = null;
  let externalId: string | null = null;
  let channel = "dm";
  let sentAt = new Date();
  let postExternalId: string | null = null;
  let followPayload: string | null = null;

  if (isMessagingEventType(type)) {
    const m = normalizeMessagingEvent(value) as MessagingEvent;
    if (m.message?.is_echo) return "trace:echo"; // our own outbound echo
    externalUserId = m.sender?.id ?? null;
    if (!externalUserId || externalUserId === args.accountExternalId)
      return "trace:self_or_unknown_sender";
    const content = messagingContent(m);
    followPayload = content.payload;
    body = content.body;
    // Instagram reuses the mid of the message that carried the button for
    // postback taps. That mid is already stored for our outbound prompt, so it
    // must not be used as the inbound id or the tap is dropped as a duplicate.
    externalId = content.externalId;
    if (m.timestamp) sentAt = new Date(m.timestamp);

    const gateId = followGateId(followPayload);
    if (gateId) {
      const gateAccount = await findGateAccount(admin, gateId, args.receivingExternalId);
      if (gateAccount) {
        organizationId = gateAccount.organization_id;
        socialAccountId = gateAccount.id;
        platform = gateAccount.platform;
      }
    }
  } else if (type.endsWith(".comments") || type.endsWith(".feed")) {
    const c = (value as { value?: CommentValue }).value ?? (value as CommentValue);
    if (c.item && c.item !== "comment") return "trace:not_a_comment";
    if (c.verb === "remove") return "trace:comment_removed";
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

    // Record that the button reached us independently of whether follow status
    // can be checked or the next message can be delivered.
    if (followPayload?.startsWith("AUTOMATION_FOLLOW_CHECK:")) {
      await admin.from("automation_runs").insert({
        organization_id: organizationId,
        conversation_id: conversation.id,
        rule_id: null,
        status: "matched",
        detail: "gate_tap_received",
      });
    }

    // Resolve both payload-bearing buttons and Instagram's text-only quick
    // reply delivery before trying ordinary DM keyword rules.
    if (followPayload || body) {
      const handled = await handleFollowGateReply(admin, {
        organizationId,
        conversationId: conversation.id,
        socialAccountId,
        platform,
        externalUserId,
        payload: followPayload ?? "",
        messageText: body,
        receivingExternalId: args.receivingExternalId,
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
            ...(entry.standby ?? []).map((m) => ({
              type: `${payload.object ?? "meta"}.standby`,
              value: m as unknown,
            })),
          ];

          if (items.length === 0) {
            items.push({ type: `${payload.object ?? "meta"}.entry`, value: entry });
          }

          for (const [index, item] of items.entries()) {
            const normalized = isMessagingEventType(item.type)
              ? normalizeMessagingEvent(item.value)
              : null;
            const gateId = followGateId(normalized ? messagingContent(normalized).payload : null);
            const gateAccount = gateId
              ? await findGateAccount(supabaseAdmin, gateId, externalId)
              : null;
            const itemOrganizationId = gateAccount?.organization_id ?? organizationId;
            const itemSocialAccountId = gateAccount?.id ?? socialAccountId;
            const itemPlatform = gateAccount?.platform ?? platform;
            const identity = eventIdentity(item, `${entry.time ?? 0}:${index}`);
            const dedupeKey = `meta:${externalId ?? "unknown"}:${item.type}:${identity}`;
            const { data: webhookEvent, error } = await supabaseAdmin
              .from("webhook_events")
              .insert({
                provider: "meta",
                platform: itemPlatform,
                organization_id: itemOrganizationId,
                social_account_id: itemSocialAccountId,
                external_account_id: externalId,
                event_type: item.type,
                dedupe_key: dedupeKey,
                payload: item.value as never,
                signature_valid: true,
                status: itemOrganizationId ? "received" : "ignored",
                ...(itemOrganizationId ? {} : { error: "No connected account or follow gate matched this id" }),
              })
              .select("id")
              .maybeSingle();
            // Duplicate delivery (Meta retries) — safe to skip.
            if (error && error.code !== "23505") console.error("webhook insert failed", error);

            // Mirror into the inbox (conversations/messages).
            if (itemOrganizationId && itemPlatform && webhookEvent?.id) {
              try {
                await ingestIntoInbox(supabaseAdmin, {
                  organizationId: itemOrganizationId,
                  socialAccountId: itemSocialAccountId,
                  platform: itemPlatform,
                  accountExternalId: externalId,
                  receivingExternalId: externalId,
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
