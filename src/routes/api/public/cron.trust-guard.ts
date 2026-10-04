import { createFileRoute } from "@tanstack/react-router";

/** Scheduler endpoint: predictive rate-limit guard (short auto-pause on Meta rate-limit signals). Cron-secret protected. */
export const Route = createFileRoute("/api/public/cron/trust-guard")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["CRON_SECRET"];
        if (!secret) return new Response("Scheduler not configured", { status: 503 });
        if (request.headers.get("x-cron-secret") !== secret) return new Response("Unauthorized", { status: 401 });
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
