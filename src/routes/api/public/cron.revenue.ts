import { createFileRoute } from "@tanstack/react-router";

/** Scheduler endpoint: sends payment reminders inside Meta's 24h window. Cron-secret protected. */
export const Route = createFileRoute("/api/public/cron/revenue")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["CRON_SECRET"];
        if (!secret) return new Response("Scheduler not configured", { status: 503 });
        if (request.headers.get("x-cron-secret") !== secret) return new Response("Unauthorized", { status: 401 });
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
