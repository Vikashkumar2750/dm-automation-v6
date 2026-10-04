import { createFileRoute } from "@tanstack/react-router";

/** Scheduler endpoint: delivers new messages to workspace outgoing webhooks. Cron-secret protected. */
export const Route = createFileRoute("/api/public/cron/team-webhooks")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["CRON_SECRET"];
        if (!secret) return new Response("Scheduler not configured", { status: 503 });
        if (request.headers.get("x-cron-secret") !== secret) return new Response("Unauthorized", { status: 401 });
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
