import { createFileRoute } from "@tanstack/react-router";

/** Scheduled database backup. Cron-secret protected; does nothing unless Super Admin turned auto-backup on. */
export const Route = createFileRoute("/api/public/cron/db-backup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { cronAuthFailure } = await import("@/lib/cron-secret.server");
        const denied = cronAuthFailure(request, "/api/public/cron/db-backup");
        if (denied) return denied;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { readBackupSettings, runBackup } = await import("@/lib/db-backup.server");
        const s = await readBackupSettings(supabaseAdmin);
        if (!s.auto) return Response.json({ skipped: "auto backup off" });
        try {
          const r = await runBackup(supabaseAdmin, "scheduled", null, s.includeSensitive);
          return Response.json({ ok: true, rows: r.rowCount, drive: Boolean(r.driveId), driveError: r.driveError });
        } catch {
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
