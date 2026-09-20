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
