import { createFileRoute } from "@tanstack/react-router";

/** Scheduler endpoint: sends payment reminders inside Meta's 24h window. Cron-secret protected. */
export const Route = createFileRoute("/api/public/cron/revenue")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { cronAuthFailure } = await import("@/lib/cron-secret.server");
        const denied = cronAuthFailure(request, "/api/public/cron/revenue");
        if (denied) return denied;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runPaymentNudges } = await import("@/lib/revenue.server");
        try {
          return Response.json(await runPaymentNudges(supabaseAdmin));
        } catch (e) {
          return Response.json({ error: (e as Error).message });
        }
      },
    },
  },
});
