import { createFileRoute } from "@tanstack/react-router";

/** Retired partial-backup scheduler; preserve its URL so old jobs fail explicitly without exporting data. */
export const Route = createFileRoute("/api/public/cron/db-backup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { cronAuthFailure } = await import("@/lib/cron-secret.server");
        const denied = cronAuthFailure(request, "/api/public/cron/db-backup");
        if (denied) return denied;
        return Response.json({ error: "Partial backups are retired. Disable this scheduled job; full-dump scheduling is not configured." }, { status: 410 });
      },
    },
  },
});
