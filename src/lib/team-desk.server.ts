import { API_KEY_PREFIX, isApiKeyFormat } from "./team-desk";
import { postWebhook } from "./webhook-destination.server";

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function randomToken(len: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let out = "";
  for (const b of bytes) out += ALPHA[b % ALPHA.length];
  return out;
}

export function generateApiKey(): string {
  return API_KEY_PREFIX + randomToken(40);
}

export async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Resolves an X-API-Key header to its workspace; returns null for missing/invalid/revoked keys. */
export async function authenticateApiKey(request: Request): Promise<{ organizationId: string; keyId: string } | null> {
  const raw = request.headers.get("x-api-key")?.trim() ?? "";
  if (!isApiKeyFormat(raw)) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const hash = await sha256Hex(raw);
  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, organization_id, revoked_at")
    .eq("key_hash", hash)
    .maybeSingle();
  if (error || !data || data.revoked_at) return null;
  await supabaseAdmin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return { organizationId: data.organization_id, keyId: data.id };
}

/** Sends new messages to every enabled outgoing webhook, signed with its secret. */
export async function dispatchOutgoingWebhooks() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { eventForDirection } = await import("./team-desk");
  const { data: hooks, error: hooksError } = await supabaseAdmin.from("outgoing_webhooks").select("*").eq("enabled", true).limit(200);
  if (hooksError) throw new Error("Webhook configuration unavailable.");
  let sent = 0;
  let failed = 0;
  for (const hook of hooks ?? []) {
    const { data: msgs, error: messagesError } = await supabaseAdmin
      .from("messages")
      .select("id, conversation_id, direction, body, sender_name, sent_at, created_at, conversations!inner(organization_id, platform, channel, external_user_id, external_user_name)")
      .eq("conversations.organization_id", hook.organization_id)
      .gt("created_at", hook.cursor_at)
      .order("created_at", { ascending: true })
      .limit(50);
    if (messagesError) throw new Error("Webhook messages unavailable.");
    const rows = (msgs ?? []).filter((m) => hook.events.includes(eventForDirection(m.direction)));
    const last = msgs?.at(-1)?.created_at ?? null;
    if (!rows.length) {
      if (last) {
        const { error } = await supabaseAdmin.from("outgoing_webhooks").update({ cursor_at: last }).eq("id", hook.id);
        if (error) throw new Error("Webhook progress could not be saved.");
      }
      continue;
    }
    const payload = JSON.stringify({
      workspace_id: hook.organization_id,
      events: rows.map((m) => {
        const c = m.conversations as unknown as { platform: string; channel: string; external_user_id: string; external_user_name: string | null };
        return {
          type: eventForDirection(m.direction),
          message_id: m.id,
          conversation_id: m.conversation_id,
          platform: c.platform,
          channel: c.channel,
          contact: { id: c.external_user_id, name: c.external_user_name },
          text: m.body,
          sent_at: m.sent_at,
        };
      }),
    });
    const ts = Math.floor(Date.now() / 1000).toString();
    let status = 0;
    let error: string | null = null;
    try {
      status = await postWebhook(hook.url, payload, {
        "x-autodm-timestamp": ts, "x-autodm-signature": await hmacHex(hook.secret, `${ts}.${payload}`),
      });
      if (status < 200 || status >= 300) error = `HTTP ${status}`;
    } catch {
      error = "Webhook request failed.";
    }
    // Advance the cursor only on success so failed batches retry next tick.
    const { error: writeError } = await supabaseAdmin
      .from("outgoing_webhooks")
      .update({ last_status: status || null, last_error: error, last_sent_at: new Date().toISOString(), ...(!error && last ? { cursor_at: last } : {}) })
      .eq("id", hook.id);
    if (writeError) throw new Error("Webhook delivery status could not be saved.");
    if (error) failed++;
    else sent += rows.length;
  }
  return { hooks: hooks?.length ?? 0, sent, failed };
}
