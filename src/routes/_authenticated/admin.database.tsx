import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Download, Loader2, Play, RefreshCw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { createBackup, deleteBackup, downloadBackup, listBackups, runAdminSql, saveBackupSchedule } from "@/lib/db-backup.functions";

export const Route = createFileRoute("/_authenticated/admin/database")({
  head: () => ({
    meta: [
      { title: "Database Backups — Techaasvik Operations" },
      { name: "description", content: "Super Admin database backups, scheduled export, SQL import and query runner." },
      { property: "og:title", content: "Database Backups — Techaasvik Operations" },
      { property: "og:description", content: "Export, import and schedule AutoDM database backups." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminDatabasePage,
});

function saveFile(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/sql" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const kb = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

async function downloadPgDump(mode: "full" | "schema" | "data") {
  const { data } = await supabase.auth.getSession();
  const res = await fetch("/api/admin/db-dump", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: JSON.stringify({ mode }),
  });
  if (!res.ok) throw new Error((await res.text()).slice(0, 300) || `Failed (${res.status})`);
  const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? `autodm-${mode}.sql`;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function PgDumpSection() {
  const [busy, setBusy] = useState<string | null>(null);
  const go = async (mode: "full" | "schema" | "data") => {
    setBusy(mode);
    try { await downloadPgDump(mode); toast.success("Dump downloaded"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Dump failed"); }
    finally { setBusy(null); }
  };
  const btn = (mode: "full" | "schema" | "data", label: string, variant: "default" | "outline" = "outline") => (
    <Button variant={variant} onClick={() => go(mode)} disabled={!!busy}>
      {busy === mode ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}{label}
    </Button>
  );
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <h2 className="font-semibold">Full database dump (pg_dump)</h2>
      <p className="text-sm text-muted-foreground">Real pg_dump using the server's database connection: tables, functions, policies and data for app, user accounts and file records. Uploaded files themselves are not included. Keep the file private — it contains user accounts and secrets.</p>
      <div className="flex flex-wrap gap-2">
        {btn("full", "Download full dump", "default")}
        {btn("schema", "Structure only")}
        {btn("data", "Data only (incl. users)")}
      </div>
    </section>
  );
}

function AdminDatabasePage() {
  const qc = useQueryClient();
  const list = useServerFn(listBackups);
  const create = useServerFn(createBackup);
  const download = useServerFn(downloadBackup);
  const del = useServerFn(deleteBackup);
  const saveSched = useServerFn(saveBackupSchedule);
  const runSql = useServerFn(runAdminSql);
  const q = useQuery({ queryKey: ["admin-db-backups"], queryFn: () => list() });
  const [busy, setBusy] = useState<string | null>(null);
  const [sens, setSens] = useState(false);
  const [auto, setAuto] = useState(false);
  const [keep, setKeep] = useState(14);
  const [schedSens, setSchedSens] = useState(false);
  const [sql, setSql] = useState("");
  const [result, setResult] = useState<string>("");
  useEffect(() => { if (q.data) { setAuto(q.data.settings.auto); setKeep(q.data.settings.keep); setSchedSens(q.data.settings.includeSensitive); } }, [q.data]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-db-backups"] });

  const doBackup = async (thenDownload: boolean) => {
    setBusy("backup");
    try {
      const r = await create({ data: { includeSensitive: sens } });
      toast.success(`Backup ready · ${r.rowCount} rows from ${r.tableCount} tables${r.driveId ? " · saved to Google Drive" : ""}`);
      if (r.driveError) toast.error(r.driveError);
      if (thenDownload) { const f = await download({ data: { id: r.id } }); saveFile(f.name, f.sql); }
      await refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Backup failed"); }
    setBusy(null);
  };
  const execute = async (text: string, source: "editor" | "import") => {
    if (!text.trim()) return;
    const isRead = /^\s*(select|with|table|values|explain)\s/i.test(text);
    if (!isRead && !confirm("This will change the database. Take a backup first. Continue?")) return;
    setBusy(source);
    try {
      const r = (await runSql({ data: { sql: text, source } })) as { ok: false; error: string } | { ok: true; result: { rows?: unknown[]; affected?: number } };
      if (!r.ok) { setResult(`Error: ${r.error}`); toast.error("SQL failed — nothing was changed"); }
      else { setResult(r.result.rows ? JSON.stringify(r.result.rows, null, 2) : `Done. Rows affected: ${r.result.affected ?? 0}`); toast.success(source === "import" ? "Import finished" : "SQL ran"); }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    setBusy(null);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Database Backups</h1>
          <p className="text-sm text-muted-foreground">Export, import, schedule backups and run SQL. Every action is recorded in Security & Audit.</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={q.isFetching}><RefreshCw className="mr-1 h-4 w-4" />Refresh</Button>
      </div>

      <PgDumpSection />

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="font-semibold">Export</h2>
        <p className="text-sm text-muted-foreground">Creates a data-only .sql file. Applying it on another database keeps existing rows and skips rows that don't fit, so it is safe to run more than once.</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sens} onChange={(e) => setSens(e.target.checked)} />Include sensitive tables (account tokens, payment keys, OTP/API keys)</label>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => doBackup(true)} disabled={!!busy}>{busy === "backup" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}Backup now & download</Button>
          <Button variant="outline" onClick={() => doBackup(false)} disabled={!!busy}>Backup only (save here)</Button>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="font-semibold">Auto backup schedule</h2>
        <p className="text-sm text-muted-foreground">
          When on, the scheduler saves a backup each time it calls the backup job (set it to daily). Google Drive: {q.data?.driveConnected ? "connected — backups are also uploaded there." : "not connected — backups are kept here only."}
        </p>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />Auto backup on</label>
          <label className="flex items-center gap-2">Keep last <input type="number" min={1} max={60} value={keep} onChange={(e) => setKeep(Number(e.target.value) || 1)} className="w-16 rounded border bg-background px-2 py-1" /> backups</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={schedSens} onChange={(e) => setSchedSens(e.target.checked)} />Include sensitive tables</label>
          <Button size="sm" disabled={!!busy || !q.data} onClick={async () => { try { await saveSched({ data: { auto, keep, includeSensitive: schedSens } }); toast.success("Schedule saved"); refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); } }}>Save</Button>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="font-semibold">Saved backups</h2>
        {q.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : q.isError ? <p className="text-sm text-destructive">Backups unavailable. Refresh to retry.</p> : !q.data?.backups.length ? <p className="text-sm text-muted-foreground">No backups yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground"><th className="py-2">When</th><th>Type</th><th>Rows</th><th>Size</th><th>Drive</th><th /></tr></thead>
              <tbody>
                {q.data.backups.map((b: any) => (
                  <tr key={b.id} className="border-t">
                    <td className="py-2">{new Date(b.created_at).toLocaleString()}</td>
                    <td>{b.kind}{b.status === "failed" && <span className="ml-1 text-destructive">failed</span>}</td>
                    <td>{b.status === "ok" ? `${b.row_count} / ${b.table_count} tables` : "—"}</td>
                    <td>{b.bytes ? kb(b.bytes) : "—"}</td>
                    <td title={b.error ?? ""}>{b.drive_file_id ? "Saved" : b.error ? "Error" : "—"}</td>
                    <td className="space-x-1 whitespace-nowrap text-right">
                      {b.status === "ok" && <Button size="sm" variant="outline" disabled={!!busy} onClick={async () => { try { const f = await download({ data: { id: b.id } }); saveFile(f.name, f.sql); } catch (e) { toast.error(e instanceof Error ? e.message : "Download failed"); } }}><Download className="h-4 w-4" /></Button>}
                      <Button size="sm" variant="ghost" disabled={!!busy} onClick={async () => { if (!confirm("Delete this backup?")) return; await del({ data: { id: b.id } }); refresh(); }}><Trash2 className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="font-semibold">Import .sql file</h2>
        <p className="text-sm text-muted-foreground">Runs the whole file at once. If any statement fails, nothing is changed.</p>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
          {busy === "import" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Choose .sql file
          <input type="file" accept=".sql,text/plain" className="hidden" disabled={!!busy} onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) await execute(await f.text(), "import"); }} />
        </label>
      </section>

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="font-semibold">Run SQL</h2>
        <p className="text-sm text-muted-foreground">SELECT shows up to 500 rows. Other statements change data — take a backup first.</p>
        <textarea value={sql} onChange={(e) => setSql(e.target.value)} rows={8} placeholder="select count(*) from organizations;" className="w-full rounded-md border bg-background p-2 font-mono text-xs" />
        <Button onClick={() => execute(sql, "editor")} disabled={!!busy || !sql.trim()}>{busy === "editor" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />}Run</Button>
        {result && <pre className="max-h-96 overflow-auto rounded-md bg-muted p-2 text-xs">{result}</pre>}
      </section>
    </div>
  );
}
