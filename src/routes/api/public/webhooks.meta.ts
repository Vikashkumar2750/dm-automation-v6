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

type AdminClient = Awaited<
  ReturnType<typeof import("@/integrations/supabase/client.server")>
>["supabaseAdmin"];

type MessagingEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: { mid?: string; text?: string; is_echo?: boolean };
};

type CommentValue = {
  item?: string;
  comment_id?: string;
  id?: string;
  text?: string;
  message?: string;
  from?: { id?: string; username?: string; name?: string };
};

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

  if (type.endsWith(".message")) {
    const m = value as MessagingEvent;
    if (m.message?.is_echo) return; // our own outbound echo
    externalUserId = m.sender?.id ?? null;
    if (!externalUserId || externalUserId === args.accountExternalId) return;
    body = m.message?.text ?? null;
    externalId = m.message?.mid ?? null;
    if (m.timestamp) sentAt = new Date(m.timestamp);
  } else if (type.endsWith(".comments") || type.endsWith(".feed")) {
    const c = (value as { value?: CommentValue }).value ?? (value as CommentValue);
    if (c.item && c.item !== "comment") return;
    externalUserId = c.from?.id ?? null;
    if (!externalUserId) return;
    externalUserName = c.from?.username ?? c.from?.name ?? null;
    body = c.text ?? c.message ?? null;
    externalId = c.comment_id ?? c.id ?? null;
    channel = "comment";
  } else {
    return;
  }

  if (!body) return;

  const { data: conversation } = await admin
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

  if (!conversation) return;

  const { error: msgError } = await admin.from("messages").insert({
    conversation_id: conversation.id,
    direction: "inbound",
    body,
    external_id: externalId,
    sender_name: externalUserName,
    sent_at: sentAt.toISOString(),
  });
  // Duplicate external_id — already ingested.
  if (msgError && msgError.code !== "23505") return;
  if (msgError) return;

  await admin.rpc("increment_unread", { p_conversation_id: conversation.id }).maybeSingle?.();
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

        const platform = platformFor(payload.object);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        for (const entry of payload.entry ?? []) {
          const externalId = entry.id ?? null;

          // Resolve which workspace this account belongs to (page id or IG user id).
          let organizationId: string | null = null;
          let socialAccountId: string | null = null;
          if (externalId) {
            const { data: account } = await supabaseAdmin
              .from("social_accounts")
              .select("id, organization_id")
              .eq("external_id", externalId)
              .maybeSingle();
            organizationId = account?.organization_id ?? null;
            socialAccountId = account?.id ?? null;
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
            const dedupeKey = `meta:${externalId ?? "unknown"}:${entry.time ?? 0}:${item.type}:${index}`;
            const { error } = await supabaseAdmin.from("webhook_events").insert({
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
            });
            // Duplicate delivery (Meta retries) — safe to skip.
            if (error && error.code !== "23505") console.error("webhook insert failed", error);
          }
        }

        // Always 200 quickly so Meta does not retry storm.
        return new Response("EVENT_RECEIVED", { status: 200 });
      },
    },
  },
});
