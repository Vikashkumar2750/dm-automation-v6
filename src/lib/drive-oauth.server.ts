// Direct Google Drive OAuth for the Super Admin backup destination.
// Refresh token is sealed with TOKEN_ENCRYPTION_KEY in a server-only table.
import { readToken, storeToken, tokenKey } from "@/lib/token-crypto.server";

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const DRIVE_CALLBACK_PATH = "/api/public/drive-oauth/callback";

export function publicOrigin(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (!host) return url.origin;
  return `${proto === "http" ? "http" : "https"}://${host}`;
}

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function oauthClient() {
  const id = process.env["GOOGLE_OAUTH_CLIENT_ID"];
  const secret = process.env["GOOGLE_OAUTH_CLIENT_SECRET"];
  if (!id || !secret) return null;
  return { id, secret };
}

export function authUrl(clientId: string, redirectUri: string, state: string) {
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.search = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: DRIVE_SCOPE,
    access_type: "offline", prompt: "consent", include_granted_scopes: "false", state,
  }).toString();
  return u.toString();
}

type Admin = import("@supabase/supabase-js").SupabaseClient;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (admin: Admin) => (admin as any).from("platform_drive_oauth");

export async function readDriveConnection(admin: Admin) {
  const { data, error } = await table(admin).select("refresh_token,account_email,connected_at").eq("id", true).maybeSingle();
  if (error) throw new Error("Drive connection status unavailable.");
  return { connected: Boolean(data?.refresh_token), email: (data?.account_email as string | null) ?? null, connectedAt: (data?.connected_at as string | null) ?? null };
}

export async function beginDriveConnect(admin: Admin, userId: string, origin: string) {
  const client = oauthClient();
  if (!client) throw new Error("Google sign-in credentials are not configured on this host.");
  if (!tokenKey()) throw new Error("Token encryption key is required before connecting Drive.");
  const state = crypto.randomUUID() + crypto.randomUUID();
  const { error } = await table(admin).upsert({
    id: true, pending_state_hash: await sha256Hex(state), pending_by: userId,
    pending_expires_at: new Date(Date.now() + 10 * 60000).toISOString(), updated_at: new Date().toISOString(),
  });
  if (error) throw new Error("Drive connection storage unavailable. Deploy the latest database update.");
  return authUrl(client.id, `${origin}${DRIVE_CALLBACK_PATH}`, state);
}

/** Validates the one-time state, exchanges the code and stores the sealed refresh token. */
export async function completeDriveConnect(admin: Admin, state: string, code: string, origin: string) {
  const client = oauthClient();
  if (!client || !tokenKey()) return "config";
  const hash = await sha256Hex(state);
  const { data, error } = await table(admin).select("pending_state_hash,pending_by,pending_expires_at").eq("id", true).maybeSingle();
  if (error || !data?.pending_state_hash || data.pending_state_hash !== hash) return "state";
  // Consume state first: a replayed callback can never reuse it.
  const consumed = await table(admin).update({ pending_state_hash: null, pending_expires_at: null }).eq("id", true).eq("pending_state_hash", hash).select("id");
  if (consumed.error || !consumed.data?.length) return "state";
  if (!data.pending_expires_at || Date.parse(data.pending_expires_at) < Date.now()) return "expired";
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: client.id, client_secret: client.secret, redirect_uri: `${origin}${DRIVE_CALLBACK_PATH}`, grant_type: "authorization_code" }),
  }).catch(() => null);
  if (!res?.ok) return "exchange";
  const tok = (await res.json().catch(() => ({}))) as { refresh_token?: string; access_token?: string; scope?: string };
  if (!tok.refresh_token || !tok.access_token || !String(tok.scope ?? "").includes(DRIVE_SCOPE)) return "scope";
  let email: string | null = null;
  const about = await fetch("https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)", { headers: { Authorization: `Bearer ${tok.access_token}` }, redirect: "error", signal: AbortSignal.timeout(15000) }).catch(() => null);
  if (about?.ok) email = ((await about.json().catch(() => ({}))) as { user?: { emailAddress?: string } }).user?.emailAddress ?? null;
  const saved = await table(admin).update({
    refresh_token: await storeToken(tok.refresh_token), account_email: email, connected_by: data.pending_by,
    connected_at: new Date().toISOString(), pending_by: null, updated_at: new Date().toISOString(),
  }).eq("id", true);
  if (saved.error) return "store";
  await admin.from("platform_audit_log").insert({ actor_user_id: data.pending_by, action: "db_dump.drive_connected", target_type: "database", detail: {} });
  return "ok";
}

export async function disconnectDrive(admin: Admin) {
  const { data, error } = await table(admin).select("refresh_token").eq("id", true).maybeSingle();
  if (error) throw new Error("Drive connection status unavailable.");
  if (data?.refresh_token) {
    const token = await readToken(data.refresh_token as string).catch(() => null);
    if (token) await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token }), signal: AbortSignal.timeout(10000) }).catch(() => null);
  }
  const del = await table(admin).delete().eq("id", true);
  if (del.error) throw new Error("Drive connection was not removed.");
}
