// Railway-only companion. No imports from the app or Worker runtime.
import postgres from "postgres";
import { spawn } from "node:child_process";
import { mkdtemp, stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { backupDue, driveHeaders, privateFolder, DRIVE_BACKUP_KEY } from "./drive-backup-core.mjs";

const BASE = "https://connector-gateway.lovable.dev/google_drive";
const dbUrl = process.env.DATABASE_URL;
const sql = dbUrl ? postgres(dbUrl, { max: 1, onnotice: () => {}, ssl: "prefer" }) : null;
let busy = false;
async function command(name, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(name, args, { stdio: ["ignore", "ignore", "ignore"] });
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("Backup tool timed out.")); }, 300000);
    child.on("error", () => { clearTimeout(timer); reject(new Error("Backup tools are unavailable.")); });
    child.on("close", (code) => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error("Backup tool failed.")); });
  });
}
async function drive(path, init = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...init, redirect: "error", signal: AbortSignal.timeout(300000),
    headers: { ...driveHeaders(process.env), ...init.headers },
  });
  // Never print provider bodies: upload errors may contain private metadata.
  if (!response.ok) throw new Error(`Drive request failed (${response.status}). Check connection access.`);
  return response.json();
}
async function patch(db, value) {
  await db`update public.platform_settings set feature_flags = jsonb_set(coalesce(feature_flags, '{}'::jsonb), array[${DRIVE_BACKUP_KEY}], coalesce(feature_flags->${DRIVE_BACKUP_KEY}, '{}'::jsonb) || ${db.json(value)}::jsonb), updated_at = now() where id = true`;
}
async function tick() {
  if (busy || !sql) return;
  busy = true;
  let db, directory;
  try {
    db = await sql.reserve();
    const [lock] = await db`select pg_try_advisory_lock(726041983) as acquired`;
    if (!lock?.acquired) return;
    const [row] = await db`select feature_flags->${DRIVE_BACKUP_KEY} as settings from public.platform_settings where id = true`;
    const settings = row?.settings;
    if (!backupDue(settings)) return;
    const requestId = settings.requestId ?? null;
    await patch(db, { status: "running", lastAttemptAt: new Date().toISOString(), completedRequestId: requestId });
    try {
      driveHeaders(process.env);
      // Audit must exist before any database content is exported.
      await db`insert into public.platform_audit_log (actor_user_id, action, target_type, detail) values (${settings.requestedBy ?? null}, 'db_dump.drive_requested', 'database', ${db.json({ scheduled: !requestId || requestId === settings.completedRequestId })})`;
      let folderId = settings.folderId;
      if (!folderId) {
        const folder = await drive("/drive/v3/files?fields=id", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "AutoDM private database backups", mimeType: "application/vnd.google-apps.folder" }),
        });
        if (typeof folder.id !== "string") throw new Error("Drive folder was not created.");
        folderId = folder.id;
        await patch(db, { folderId });
      }
      const folder = await drive(`/drive/v3/files/${encodeURIComponent(folderId)}?fields=mimeType,trashed,permissions(type,role)`);
      if (!privateFolder(folder)) throw new Error("Backup folder must be private and owned only by the connected account.");
      directory = await mkdtemp(join(tmpdir(), "autodm-backup-"));
      const file = join(directory, "database.dump");
      await command("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", "--schema=public", "--schema=auth", "--schema=storage", "--file", file, dbUrl]);
      await command("pg_restore", ["--list", file]);
      const { size } = await stat(file);
      if (!size || size > 536870912) throw new Error("Backup is empty or exceeds the 512 MB upload limit.");
      const name = `autodm-full-${new Date().toISOString().replace(/[:.]/g, "-")}.dump`;
      const boundary = `autodm-${crypto.randomUUID()}`;
      const body = new Blob([
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: [folderId], mimeType: "application/octet-stream" })}\r\n`,
        `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`,
        Bun.file(file), `\r\n--${boundary}--\r\n`,
      ]);
      const saved = await drive("/upload/drive/v3/files?uploadType=multipart&fields=id,size", {
        method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body,
      });
      if (!saved.id || Number(saved.size) !== size) throw new Error("Uploaded backup size could not be confirmed.");
      await patch(db, { status: "saved", lastSuccessAt: new Date().toISOString(), lastFileId: saved.id, lastFileName: name, lastBytes: size, lastError: null });
      console.log("[drive-backup] archive uploaded and byte count confirmed; restore not tested");
    } catch (error) {
      // Fixed messages only; unknown errors can contain credentials or SQL.
      const message = error instanceof Error && /^(Drive |Backup |Uploaded )/.test(error.message) ? error.message : "Backup failed. Check host connectivity and connection settings.";
      await patch(db, { status: "failed", lastError: message });
      console.warn("[drive-backup] backup failed; review Super Admin backup status");
    }
  } catch { console.warn("[drive-backup] settings or audit unavailable; no success reported"); }
  finally {
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => {});
    if (db) { await db`select pg_advisory_unlock(726041983)`.catch(() => {}); db.release(); }
    busy = false;
  }
}
if (sql) { setTimeout(tick, 20000); setInterval(tick, 60000); }
else console.warn("[drive-backup] DATABASE_URL unavailable; backup worker disabled");