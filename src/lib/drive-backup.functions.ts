import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const KEY = "__drive_backup";
async function authorized(context: { supabase: unknown }) {
  const sb = context.supabase as import("@supabase/supabase-js").SupabaseClient;
  const { data, error } = await sb.rpc("current_user_has_platform_role", { _role: "super_admin" });
  if (error || data !== true) throw new Error("Forbidden");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
async function read(admin: import("@supabase/supabase-js").SupabaseClient) {
  const { data, error } = await admin.from("platform_settings").select("feature_flags").eq("id", true).single();
  if (error || !data) throw new Error("Backup settings unavailable.");
  const flags = data.feature_flags as Record<string, unknown>;
  const settings = (flags[KEY] ?? {}) as Record<string, unknown>;
  return { flags, settings };
}
const gatewayLinked = () => Boolean(process.env['GOOGLE_DRIVE_API_KEY'] && process.env['LOVABLE_API_KEY']);
const isBackupHost = () => process.env['NITRO_PRESET'] === "node-server" || Boolean(process.env['RAILWAY_ENVIRONMENT_ID']);

export const getDriveBackup = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const admin = await authorized(context);
  const { settings } = await read(admin);
  const { readDriveConnection, oauthClient } = await import("@/lib/drive-oauth.server");
  const direct = await readDriveConnection(admin).catch(() => ({ connected: false, email: null, connectedAt: null, unavailable: true }));
  return {
    connected: direct.connected || gatewayLinked(),
    directConnected: direct.connected,
    accountEmail: direct.email,
    connectReady: Boolean(oauthClient()) && !("unavailable" in direct),
    hostReady: Boolean(process.env['DRIVE_BACKUP_DATABASE_URL']) && isBackupHost(),
    enabled: settings['enabled'] === true,
    intervalHours: [6, 12, 24].includes(Number(settings['intervalHours'])) ? Number(settings['intervalHours']) : 24,
    status: typeof settings['status'] === "string" ? settings['status'] : "not_started",
    lastSuccessAt: typeof settings['lastSuccessAt'] === "string" ? settings['lastSuccessAt'] : null,
    lastAttemptAt: typeof settings['lastAttemptAt'] === "string" ? settings['lastAttemptAt'] : null,
    lastError: typeof settings['lastError'] === "string" ? settings['lastError'] : null,
    lastFileName: typeof settings['lastFileName'] === "string" ? settings['lastFileName'] : null,
    folderId: typeof settings['folderId'] === "string" ? settings['folderId'] : null,
  };
});

export const connectDrive = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const admin = await authorized(context);
  const { beginDriveConnect, publicOrigin } = await import("@/lib/drive-oauth.server");
  const audit = await admin.from("platform_audit_log").insert({ actor_user_id: context.userId, action: "db_dump.drive_connect_started", target_type: "database", detail: {} });
  if (audit.error) throw new Error("Audit unavailable; Drive connection not started.");
  return { url: await beginDriveConnect(admin, context.userId, publicOrigin(getRequest())) };
});

export const disconnectDriveFn = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const admin = await authorized(context);
  const { disconnectDrive } = await import("@/lib/drive-oauth.server");
  const audit = await admin.from("platform_audit_log").insert({ actor_user_id: context.userId, action: "db_dump.drive_disconnected", target_type: "database", detail: {} });
  if (audit.error) throw new Error("Audit unavailable; Drive not disconnected.");
  await disconnectDrive(admin);
  // Folder belonged to the old account; next backup creates a fresh one.
  const { flags, settings } = await read(admin);
  await admin.from("platform_settings").update({ feature_flags: { ...flags, [KEY]: { ...settings, folderId: null } } as never }).eq("id", true);
  return { ok: true };
});

export const updateDriveBackup = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.discriminatedUnion("action", [
    z.object({ action: z.literal("save"), enabled: z.boolean(), intervalHours: z.union([z.literal(6), z.literal(12), z.literal(24)]) }),
    z.object({ action: z.literal("run") }),
  ]).parse(input))
  .handler(async ({ context, data }) => {
    const admin = await authorized(context);
    const { readDriveConnection } = await import("@/lib/drive-oauth.server");
    const direct = await readDriveConnection(admin).catch(() => ({ connected: false }));
    if (!direct.connected && !gatewayLinked()) throw new Error("Connect Google Drive first.");
    if (!isBackupHost()) throw new Error("Full Drive backups run on Railway, not the Cloud preview.");
    if (!process.env['DRIVE_BACKUP_DATABASE_URL']) throw new Error("Configure the independent Railway backup database first.");
    const { flags, settings } = await read(admin);
    if (settings['status'] === "running") throw new Error("A backup is running. Wait for it to finish.");
    const next = { ...settings, requestedBy: context.userId, ...(data.action === "run"
      ? { requestId: crypto.randomUUID(), status: "queued" }
      : { enabled: data.enabled, intervalHours: data.intervalHours }) };
    const audit = await admin.from("platform_audit_log").insert({ actor_user_id: context.userId, action: `db_dump.drive_${data.action}`, target_type: "database", detail: data.action === "save" ? { enabled: data.enabled, intervalHours: data.intervalHours } : {} });
    if (audit.error) throw new Error("Audit unavailable; no backup requested.");
    const result = await admin.from("platform_settings").update({ feature_flags: { ...flags, [KEY]: next } as never, updated_at: new Date().toISOString() }).eq("id", true);
    if (result.error) throw new Error("Backup settings were not saved.");
    return { ok: true };
  });
