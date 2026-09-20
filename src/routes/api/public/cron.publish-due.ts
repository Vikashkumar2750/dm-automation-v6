import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduler endpoint: publishes every post whose scheduled time has passed.
 * Protected with a shared secret so only our scheduler can call it.
 */
export const Route = createFileRoute("/api/public/cron/publish-due")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["CRON_SECRET"];
        if (!secret) {
          return new Response("Scheduler not configured", { status: 503 });
        }
        const provided =
          request.headers.get("x-cron-secret") ??
          new URL(request.url).searchParams.get("secret");
        if (provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { publishDuePosts } = await import("@/lib/publishing.server");
        const result = await publishDuePosts(supabaseAdmin);

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
