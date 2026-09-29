import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduler endpoint: polls connected YouTube channels for new comments and
 * sends the configured public replies. Protected with the shared cron secret.
 * Completely separate from the Instagram/Facebook webhook flow.
 */
export const Route = createFileRoute("/api/public/cron/youtube-comments")({
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
        const { runYouTubeCommentAutomation } = await import(
          "@/lib/youtube-automation.server"
        );
        let result: unknown;
        try {
          result = await runYouTubeCommentAutomation(supabaseAdmin);
        } catch (error) {
          return new Response(
            JSON.stringify({ error: (error as Error).message }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
