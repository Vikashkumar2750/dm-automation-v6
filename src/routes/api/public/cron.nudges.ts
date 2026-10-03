import { createFileRoute } from "@tanstack/react-router";

/** Scheduler endpoint: re-engages abandoned DM conversations inside Meta's 24h window. Cron-secret protected. */
export const Route = createFileRoute("/api/public/cron/nudges")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["CRON_SECRET"];
        if (!secret) return new Response("Scheduler not configured", { status: 503 });
        if (request.headers.get("x-cron-secret") !== secret) return new Response("Unauthorized", { status: 401 });
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
