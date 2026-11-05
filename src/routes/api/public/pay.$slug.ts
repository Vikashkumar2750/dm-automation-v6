import { createFileRoute } from "@tanstack/react-router";

/** Delivery page checkout: makes a buyer-specific Razorpay link that returns here after payment. */
export const Route = createFileRoute("/api/public/pay/$slug")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const url = new URL(request.url);
        const lead = url.searchParams.get("lead") ?? "";
        if (!/^[a-z0-9-]{3,60}$/.test(params.slug) || !/^[0-9a-f-]{36}$/i.test(lead)) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { startPageCheckout } = await import("@/lib/revenue.server");
        const origin = (process.env["PUBLIC_APP_URL"] || url.origin).replace(/\/$/, "");
        const target = await startPageCheckout(supabaseAdmin as never, params.slug, lead, origin);
        if (!target) return new Response(null, { status: 302, headers: { Location: `/api/public/pg/${params.slug}` } });
        return new Response(null, { status: 302, headers: { Location: target } });
      },
    },
  },
});
