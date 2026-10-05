import { createFileRoute } from "@tanstack/react-router";

/** Scheduler endpoint: predictive rate-limit guard (short auto-pause on Meta rate-limit signals). Cron-secret protected. */
export const Route = createFileRoute("/api/public/cron/trust-guard")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { cronAuthFailure } = await import("@/lib/cron-secret.server");
        const denied = cronAuthFailure(request, "/api/public/cron/trust-guard");
        if (denied) return denied;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runPredictiveGuard } = await import("@/lib/trust-safety.server");
        try {
          return Response.json(await runPredictiveGuard(supabaseAdmin));
        } catch (e) {
          return Response.json({ error: (e as Error).message });
        }
      },
    },
  },
});
