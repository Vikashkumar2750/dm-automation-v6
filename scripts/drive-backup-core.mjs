export const DRIVE_BACKUP_KEY = "__drive_backup";
export const BACKUP_INTERVALS = [6, 12, 24];
export function backupDue(settings, now = Date.now()) {
  if (settings?.status === "running") {
    const started = Date.parse(settings.lastAttemptAt ?? "");
    if (Number.isFinite(started) && now - started < 1800000) return false;
    return true;
  }
  if (settings?.requestId && settings.requestId !== settings.completedRequestId) return true;
  if (!settings?.enabled || !BACKUP_INTERVALS.includes(settings.intervalHours)) return false;
  const last = Date.parse(settings.lastAttemptAt ?? "");
  return !Number.isFinite(last) || now - last >= settings.intervalHours * 3600000;
}
export function driveHeaders(env) {
  if (!env.LOVABLE_API_KEY || !env.GOOGLE_DRIVE_API_KEY) throw new Error("Drive connection is not configured on this host.");
  return { Authorization: `Bearer ${env.LOVABLE_API_KEY}`, "X-Connection-Api-Key": env.GOOGLE_DRIVE_API_KEY };
}
export function privateFolder(folder) {
  return folder?.mimeType === "application/vnd.google-apps.folder" && !folder.trashed &&
    Array.isArray(folder.permissions) && folder.permissions.length === 1 && folder.permissions[0]?.role === "owner";
}
const SEALED = "enc:v1:";
/** Opens a TOKEN_ENCRYPTION_KEY-sealed value (same format as token-crypto.server). */
export async function openSealed(value, keyB64) {
  if (!value) return null;
  if (!value.startsWith(SEALED)) return value;
  if (!keyB64) throw new Error("Drive token key is missing on this host.");
  const raw = Buffer.from(keyB64, "base64");
  if (raw.length !== 32) throw new Error("Drive token key is invalid on this host.");
  const [iv, ct] = value.slice(SEALED.length).split(":");
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: Buffer.from(iv ?? "", "base64") }, key, Buffer.from(ct ?? "", "base64"));
  return new TextDecoder().decode(pt);
}
/** Direct mode when the Super Admin connected Drive; otherwise the legacy linked connection. */
export function driveTarget(env, accessToken) {
  if (accessToken) return { base: "https://www.googleapis.com", headers: { Authorization: `Bearer ${accessToken}` } };
  return { base: "https://connector-gateway.lovable.dev/google_drive", headers: driveHeaders(env) };
}
