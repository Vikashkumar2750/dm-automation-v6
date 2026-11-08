export const DRIVE_BACKUP_KEY = "__drive_backup";
export const BACKUP_INTERVALS = [6, 12, 24];
export function backupDue(settings, now = Date.now()) {
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