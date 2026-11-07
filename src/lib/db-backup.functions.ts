import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

async function adminFor(context: Ctx) {
  const { data, error } = await context.supabase.rpc("current_user_has_platform_role", { _role: "super_admin" });
  if (error || !data) throw new Error("forbidden");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function audit(admin: any, userId: string, action: string, details: Record<string, unknown>) {
  await admin.from("platform_audit_log").insert({ actor_id: userId, action, details } as never).then(() => null, () => null);
}

export const listBackups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await adminFor(context as Ctx);
    const { readBackupSettings } = await import("./db-backup.server");
    const [{ data, error }, settings] = await Promise.all([
      admin.from("db_backups").select("id, created_at, kind, status, table_count, row_count, bytes, drive_file_id, error").order("created_at", { ascending: false }).limit(60),
      readBackupSettings(admin),
    ]);
    if (error) throw new Error("Backups unavailable");
    return { backups: data ?? [], settings, driveConnected: Boolean(process.env["GOOGLE_DRIVE_API_KEY"]) };
  });

export const createBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ includeSensitive: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const c = context as Ctx;
    const admin = await adminFor(c);
    const { runBackup } = await import("./db-backup.server");
    const r = await runBackup(admin, "manual", c.userId, data.includeSensitive);
    await audit(admin, c.userId, "db_backup.create", { id: r.id, rows: r.rowCount, includeSensitive: data.includeSensitive });
    return { id: r.id, rowCount: r.rowCount, tableCount: r.tableCount, driveId: r.driveId, driveError: r.driveError };
  });

export const downloadBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const c = context as Ctx;
    const admin = await adminFor(c);
    const { data: row, error } = await admin.from("db_backups").select("created_at, backup_sql").eq("id", data.id).maybeSingle();
    if (error || !row?.backup_sql) throw new Error("Backup not found");
    await audit(admin, c.userId, "db_backup.download", { id: data.id });
    return { name: `autodm-backup-${String(row.created_at).replace(/[:.]/g, "-")}.sql`, sql: row.backup_sql as string };
  });

export const deleteBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const c = context as Ctx;
    const admin = await adminFor(c);
    const { error } = await admin.from("db_backups").delete().eq("id", data.id);
    if (error) throw new Error("Could not delete");
    await audit(admin, c.userId, "db_backup.delete", { id: data.id });
    return { ok: true };
  });

export const saveBackupSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ auto: z.boolean(), keep: z.number().int().min(1).max(60), includeSensitive: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const c = context as Ctx;
    const admin = await adminFor(c);
    const { saveBackupSettings } = await import("./db-backup.server");
    await saveBackupSettings(admin, data);
    await audit(admin, c.userId, "db_backup.settings", data);
    return { ok: true };
  });

/** Runs SQL (queries return up to 500 rows; scripts run as one transaction). Super Admin only, audited. */
export const runAdminSql = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sql: z.string().min(1).max(20_000_000), source: z.enum(["editor", "import"]) }).parse(d))
  .handler(async ({ context, data }) => {
    const c = context as Ctx;
    const admin = await adminFor(c);
    await audit(admin, c.userId, data.source === "import" ? "db_sql.import" : "db_sql.run", { bytes: data.sql.length, preview: data.sql.slice(0, 200) });
    const { data: res, error } = await admin.rpc("admin_exec_sql", { q: data.sql });
    if (error) return { ok: false as const, error: error.message as string };
    return { ok: true as const, result: res as { rows?: Record<string, unknown>[]; affected?: number } };
  });
