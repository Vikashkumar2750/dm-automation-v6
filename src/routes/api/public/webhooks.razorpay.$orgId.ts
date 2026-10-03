import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/** Razorpay payment webhook, one URL per workspace. Signature verified with that workspace's secret. */
export const Route = createFileRoute("/api/public/webhooks/razorpay/$orgId")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!z.string().uuid().safeParse(params.orgId).success) return new Response("Not found", { status: 404 });
        const body = await request.text();
        if (body.length > 100_000) return new Response("Too large", { status: 413 });
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { handleRazorpayWebhook } = await import("@/lib/revenue.server");
          const r = await handleRazorpayWebhook(supabaseAdmin, params.orgId, body, request.headers.get("x-razorpay-signature"));
          return new Response(r.status === 200 ? "ok" : "Invalid signature", { status: r.status });
        } catch (e) {
          console.error("razorpay webhook failed", e);
          return new Response("error", { status: 500 });
        }
      },
    },
  },
});
