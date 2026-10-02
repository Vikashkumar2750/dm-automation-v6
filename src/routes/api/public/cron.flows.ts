import { createFileRoute } from "@tanstack/react-router";

/** Scheduler endpoint: resumes Phase B flows after a Wait step. Cron-secret protected. */
export const Route = createFileRoute("/api/public/cron/flows")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["CRON_SECRET"];
        if (!secret) return new Response("Scheduler not configured", { status: 503 });
        const provided = request.headers.get("x-cron-secret") ?? new URL(request.url).searchParams.get("secret");
        if (provided !== secret) return new Response("Unauthorized", { status: 401 });
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
