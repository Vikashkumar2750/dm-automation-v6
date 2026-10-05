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
        const { cronAuthFailure } = await import("@/lib/cron-secret.server");
        const denied = cronAuthFailure(request, "/api/public/cron/youtube-comments");
        if (denied) return denied;

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
