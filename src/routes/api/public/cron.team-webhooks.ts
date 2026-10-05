import { createFileRoute } from "@tanstack/react-router";

/** Scheduler endpoint: delivers new messages to workspace outgoing webhooks. Cron-secret protected. */
export const Route = createFileRoute("/api/public/cron/team-webhooks")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { cronAuthFailure } = await import("@/lib/cron-secret.server");
        const denied = cronAuthFailure(request, "/api/public/cron/team-webhooks");
        if (denied) return denied;
        const { dispatchOutgoingWebhooks } = await import("@/lib/team-desk.server");
        try {
          return Response.json(await dispatchOutgoingWebhooks());
        } catch (e) {
          return Response.json({ error: (e as Error).message });
        }
      },
    },
  },
});
