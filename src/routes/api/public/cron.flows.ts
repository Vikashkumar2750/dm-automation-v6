import { createFileRoute } from "@tanstack/react-router";

/** Scheduler endpoint: resumes Phase B flows after a Wait step. Cron-secret protected. */
export const Route = createFileRoute("/api/public/cron/flows")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { cronAuthFailure } = await import("@/lib/cron-secret.server");
        const denied = cronAuthFailure(request, "/api/public/cron/flows");
        if (denied) return denied;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { resumeDueFlows } = await import("@/lib/flows-runner.server");
        try {
          const result = await resumeDueFlows(supabaseAdmin);
          return Response.json(result);
        } catch (e) {
          return Response.json({ error: (e as Error).message });
        }
      },
    },
  },
});
