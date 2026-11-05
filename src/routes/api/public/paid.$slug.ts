import { createFileRoute } from "@tanstack/react-router";

/** Razorpay return after payment: verifies the signature, then opens the page signed in. */
export const Route = createFileRoute("/api/public/paid/$slug")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        if (!/^[a-z0-9-]{3,60}$/.test(params.slug)) return new Response("Not found", { status: 404 });
        const url = new URL(request.url);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { finishPageCheckout } = await import("@/lib/revenue.server");
        const origin = (process.env["PUBLIC_APP_URL"] || url.origin).replace(/\/$/, "");
        const token = await finishPageCheckout(supabaseAdmin as never, params.slug, url.searchParams, origin);
        // Token travels in the hash so it never reaches server logs or other sites.
        const to = token ? `/p/${params.slug}#paid=${token}` : `/p/${params.slug}#paid=failed`;
        return new Response(null, { status: 302, headers: { Location: to, "Cache-Control": "no-store" } });
      },
    },
  },
});
