import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Download, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { runAdminSql } from "@/lib/db-backup.functions";
import { DriveBackupPanel } from "@/components/admin/DriveBackupPanel";

export const Route = createFileRoute("/_authenticated/admin/database")({
  head: () => ({
    meta: [
      { title: "Database Backups — Techaasvik Operations" },
      { name: "description", content: "Super Admin full database dump download and SQL runner." },
      { property: "og:title", content: "Database Backups — Techaasvik Operations" },
      { property: "og:description", content: "Download full AutoDM database dumps." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminDatabasePage,
});


async function downloadPgDump(mode: "full" | "schema" | "data") {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Sign in again before downloading a database dump.");
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
  const runSql = useServerFn(runAdminSql);
  const [busy, setBusy] = useState(false);
  const [sql, setSql] = useState("");
  const [result, setResult] = useState<string>("");

  const execute = async () => {
    const text = sql;
    if (!text.trim()) return;
    if (!confirm("SQL may change the database, including statements beginning with SELECT or WITH. Keep a full dump before continuing. Run this SQL?")) return;
    setBusy(true);
    setResult("");
    try {
      const r = (await runSql({ data: { sql: text, source: "editor" } })) as { ok: false; error: string } | { ok: true; result: { rows?: unknown[]; affected?: number } };
      if (!r.ok) { setResult(`Error: ${r.error}`); toast.error("SQL failed — review the error before retrying"); }
      else { setResult(r.result.rows ? JSON.stringify(r.result.rows, null, 2) : `Done. Rows affected: ${r.result.affected ?? 0}`); toast.success("SQL ran"); }
    } catch (e) { const message = e instanceof Error ? e.message : "Failed"; setResult(`Error: ${message}`); toast.error(message); }
    finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Database Backups</h1>
        <p className="text-sm text-muted-foreground">Download a full database dump and run SQL. Every action is recorded in Security & Audit.</p>
      </div>

      <PgDumpSection />
      <DriveBackupPanel />

      <section className="space-y-2 rounded-lg border bg-card p-4">
        <h2 className="font-semibold">Restoring a full dump</h2>
        <p className="text-sm text-muted-foreground">A full dump is restored with psql on a new, empty database: <code className="rounded bg-muted px-1">psql "NEW_DATABASE_URL" -f autodm-full.sql</code>. It cannot be pasted into the box below because it contains psql-only commands.</p>
      </section>

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="font-semibold">Run SQL</h2>
        <p className="text-sm text-muted-foreground">SELECT shows up to 500 rows. Other statements change data — download a full dump first.</p>
        <textarea aria-label="SQL query" disabled={busy} value={sql} onChange={(e) => setSql(e.target.value)} rows={8} placeholder="select count(*) from organizations;" className="w-full rounded-md border bg-background p-2 font-mono text-xs" />
        <Button onClick={execute} disabled={busy || !sql.trim()}>{busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />}Run</Button>
        {result && <pre className="max-h-96 overflow-auto rounded-md bg-muted p-2 text-xs">{result}</pre>}
      </section>
    </div>
  );
}
