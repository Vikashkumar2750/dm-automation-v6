import { createFileRoute } from "@tanstack/react-router";
import { Download, Database, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inboxRelinkDiagnosticSql } from "@/lib/inbox-relink-diagnostic";

export const Route = createFileRoute("/_authenticated/admin/database")({
  head: () => ({ meta: [
    { title: "Database Recovery — AutoDM Operations" },
    { name: "description", content: "AutoDM database recovery guidance and read-only Inbox account diagnostics." },
    { property: "og:title", content: "Database Recovery — AutoDM Operations" },
    { property: "og:description", content: "Supported backup recovery and safe Inbox diagnostics for AutoDM administrators." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: AdminDatabasePage,
});

function downloadDiagnostic() {
  const url = URL.createObjectURL(new Blob([inboxRelinkDiagnosticSql], { type: "application/sql" }));
  const link = document.createElement("a");
  link.href = url; link.download = "AutoDM-Inbox-Diagnostic.sql"; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function AdminDatabasePage() {
  return <div className="mx-auto w-full min-w-0 max-w-5xl space-y-8 p-4 md:p-6">
    <header className="flex items-center gap-3">
      <Database className="h-6 w-6 shrink-0 text-primary" />
      <h1 className="text-2xl font-bold">Database Backups & Recovery</h1>
    </header>
    <section className="space-y-3 border-b pb-6">
      <h2 className="text-lg font-semibold">Complete database export</h2>
      <p className="text-sm text-muted-foreground">Lovable Cloud: More → Database → Manage → Settings → Export data → Database → Export → Start export.</p>
      <p className="text-sm text-muted-foreground">The export includes database structure, data and user accounts with password hashes. Storage files, secrets and sign-in provider settings are not included. Download storage files separately from More → Storage.</p>
      <p className="text-sm text-muted-foreground">For an independently hosted live database, use that database owner's supported export and restore tools. Confirm the destination before importing.</p>
      <p role="alert" className="text-sm text-destructive">Legacy in-app SQL exports are not complete backups: user accounts and schema were omitted, and failed rows could be skipped. In-app full exports, imports and arbitrary SQL execution are disabled.</p>
    </section>
    <section className="space-y-3 border-b pb-6">
      <h2 className="text-lg font-semibold">Daily snapshots & restore</h2>
      <p className="text-sm text-muted-foreground">Lovable Cloud provides one database snapshot per day, retained for up to roughly 14 days. View available timestamps in More → Database → Manage → Backups. Google Drive scheduling is not configured here.</p>
      <p className="text-sm text-muted-foreground">Restore targets a daily snapshot in the same project, not an arbitrary time or an individual table. Data written after it is lost, the schema reverts, and the database is unavailable for a few minutes. Export the current state first; storage files are not covered.</p>
    </section>
    <section className="space-y-3">
      <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold">Inbox account diagnostics</h2></div>
      <p className="text-sm text-muted-foreground">A remaining unlinked chat is not a SQL error. The original account may be absent or ambiguous; do not assign it to an unrelated account.</p>
      <Button variant="outline" onClick={downloadDiagnostic}><Download className="mr-2 h-4 w-4" />Download read-only diagnostic</Button>
    </section>
  </div>;
}
