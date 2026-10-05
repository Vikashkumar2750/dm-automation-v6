import { createFileRoute } from "@tanstack/react-router";

/** Scheduler endpoint: re-engages abandoned DM conversations inside Meta's 24h window. Cron-secret protected. */
export const Route = createFileRoute("/api/public/cron/nudges")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { cronAuthFailure } = await import("@/lib/cron-secret.server");
        const denied = cronAuthFailure(request, "/api/public/cron/nudges");
        if (denied) return denied;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runConversationNudges } = await import("@/lib/nudges.server");
        try {
          return Response.json(await runConversationNudges(supabaseAdmin));
        } catch (e) {
          return Response.json({ error: (e as Error).message });
        }
      },
    },
  },
});
