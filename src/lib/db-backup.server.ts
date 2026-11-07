/**
 * Database backup/restore helpers (Super Admin only — callers must verify first).
 * Exports public-schema data as a re-runnable SQL script: every row is inserted with
 * ON CONFLICT DO NOTHING inside its own exception guard, so applying it twice or onto a
 * database that already has some rows never fails the whole script.
 */
type Admin = any;

export const SENSITIVE_TABLES = [
  "social_account_tokens", "payment_credentials", "whatsapp_otp_settings", "api_keys",
  "buyer_login_codes", "buyer_sessions", "lead_otp_codes", "oauth_states",
];
const SKIP_ALWAYS = ["db_backups"];
const PAGE = 1000;
const MAX_ROWS_PER_TABLE = 100_000;
const CHUNK = 300;

export type BackupSettings = { auto: boolean; keep: number; includeSensitive: boolean };
const KEY = "db_backup";

export async function readBackupSettings(admin: Admin): Promise<BackupSettings> {
  const { data } = await admin.from("platform_settings").select("feature_flags").eq("id", true).maybeSingle();
  const raw = ((data?.feature_flags ?? {}) as Record<string, any>)[KEY] ?? {};
  return { auto: raw.auto === true, keep: Math.min(60, Math.max(1, Number(raw.keep) || 14)), includeSensitive: raw.includeSensitive === true };
}

export async function saveBackupSettings(admin: Admin, s: BackupSettings) {
  const { data, error } = await admin.from("platform_settings").select("feature_flags").eq("id", true).maybeSingle();
  if (error) throw new Error("Settings unavailable");
  const flags = { ...((data?.feature_flags ?? {}) as Record<string, unknown>), [KEY]: s };
  const { error: e2 } = await admin.from("platform_settings").upsert({ id: true, feature_flags: flags, updated_at: new Date().toISOString() } as never, { onConflict: "id" });
  if (e2) throw new Error("Could not save settings");
}

/** Parents before children so foreign keys resolve on import. */
export function orderTables(deps: { table_name: string; depends_on: string | null }[]): string[] {
  const map = new Map<string, Set<string>>();
  for (const d of deps) {
    if (!map.has(d.table_name)) map.set(d.table_name, new Set());
    if (d.depends_on && d.depends_on !== d.table_name) map.get(d.table_name)!.add(d.depends_on);
  }
  const out: string[] = []; const seen = new Set<string>();
  const visit = (t: string, stack: Set<string>) => {
    if (seen.has(t) || stack.has(t)) return;
    stack.add(t);
    for (const p of map.get(t) ?? []) if (map.has(p)) visit(p, stack);
    stack.delete(t); seen.add(t); out.push(t);
  };
  for (const t of [...map.keys()].sort()) visit(t, new Set());
  return out;
}

function dollarTag(body: string): string {
  let tag = "j";
  while (body.includes(`$${tag}$`)) tag += "x";
  return `$${tag}$`;
}

export function rowsToSql(table: string, rows: unknown[]): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(table)) throw new Error("bad table name");
  const parts: string[] = [];
  for (let i = 0; i < rows.length; i += CHUNK) {
    const json = JSON.stringify(rows.slice(i, i + CHUNK));
    const t = dollarTag(json);
    parts.push(
      `DO $b$ DECLARE e jsonb; BEGIN FOR e IN SELECT * FROM jsonb_array_elements(${t}${json}${t}::jsonb) LOOP BEGIN INSERT INTO public.${table} SELECT * FROM jsonb_populate_record(null::public.${table}, e) ON CONFLICT DO NOTHING; EXCEPTION WHEN others THEN RAISE NOTICE 'skipped row in ${table}: %', SQLERRM; END; END LOOP; END $b$;`,
    );
  }
  return parts.join("\n");
}

export async function buildBackupSql(admin: Admin, opts: { includeSensitive: boolean }) {
  const { data: deps, error } = await admin.rpc("admin_table_dependencies");
  if (error) throw new Error("Could not list tables");
  const tables = orderTables(deps ?? []).filter(
    (t) => !SKIP_ALWAYS.includes(t) && (opts.includeSensitive || !SENSITIVE_TABLES.includes(t)),
  );
  let rowCount = 0;
  const out: string[] = [
    `-- AutoDM data backup · ${new Date().toISOString()}`,
    `-- Data only (schema must already exist). Safe to re-run: existing rows are kept, failing rows are skipped.`,
    `-- Sensitive tables ${opts.includeSensitive ? "INCLUDED" : "excluded"}.`,
    "",
  ];
  for (const t of tables) {
    const rows: unknown[] = [];
    for (let from = 0; from < MAX_ROWS_PER_TABLE; from += PAGE) {
      const { data, error: e } = await admin.from(t).select("*").range(from, from + PAGE - 1);
      if (e) throw new Error(`Could not read table ${t}`);
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    out.push(`-- ${t}: ${rows.length} rows`);
    if (rows.length) out.push(rowsToSql(t, rows));
    rowCount += rows.length;
  }
  const sql = out.join("\n") + "\n";
  return { sql, tableCount: tables.length, rowCount, bytes: new TextEncoder().encode(sql).length };
}

/** Uploads to the linked Google Drive connection when present; returns file id or null. */
export async function uploadToDrive(name: string, content: string): Promise<string | null> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const driveKey = process.env["GOOGLE_DRIVE_API_KEY"];
  if (!lovableKey || !driveKey) return null;
  const boundary = "autodm" + Math.random().toString(36).slice(2);
  const meta: Record<string, unknown> = { name, mimeType: "application/sql" };
  const folder = process.env["GOOGLE_DRIVE_BACKUP_FOLDER_ID"];
  if (folder) meta["parents"] = [folder];
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/sql\r\n\r\n${content}\r\n--${boundary}--`;
  const res = await fetch("https://connector-gateway.lovable.dev/google_drive/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": driveKey, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) throw new Error(`Google Drive upload failed [${res.status}]: ${(await res.text()).slice(0, 300)}`);
  return ((await res.json()) as { id?: string }).id ?? null;
}

export async function runBackup(admin: Admin, kind: "manual" | "scheduled", userId: string | null, includeSensitive: boolean) {
  const settings = await readBackupSettings(admin);
  try {
    const b = await buildBackupSql(admin, { includeSensitive });
    let driveId: string | null = null; let driveError: string | null = null;
    try { driveId = await uploadToDrive(`autodm-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.sql`, b.sql); }
    catch (e) { driveError = e instanceof Error ? e.message : "Drive upload failed"; }
    const { data, error } = await admin.from("db_backups").insert({
      kind, status: "ok", created_by: userId, table_count: b.tableCount, row_count: b.rowCount,
      bytes: b.bytes, drive_file_id: driveId, error: driveError, backup_sql: b.sql,
    }).select("id").single();
    if (error) throw new Error("Could not store backup");
    const { data: old } = await admin.from("db_backups").select("id").order("created_at", { ascending: false }).range(settings.keep, settings.keep + 200);
    if (old?.length) await admin.from("db_backups").delete().in("id", old.map((o: { id: string }) => o.id));
    return { id: data.id as string, ...b, driveId, driveError };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Backup failed";
    await admin.from("db_backups").insert({ kind, status: "failed", created_by: userId, error: msg });
    throw new Error(msg);
  }
}
