import { createFileRoute } from "@tanstack/react-router";

/** Retired job: authenticate existing scheduler calls, but never produce a dump. */
export const Route = createFileRoute("/api/public/cron/db-backup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { cronAuthFailure } = await import("@/lib/cron-secret.server");
        const denied = cronAuthFailure(request, "/api/public/cron/db-backup");
        if (denied) return denied;
        return Response.json({ ok: false, retired: true, message: "Use supported database backups; remove this legacy scheduled job." }, { status: 410 });
      },
    },
  },
});
