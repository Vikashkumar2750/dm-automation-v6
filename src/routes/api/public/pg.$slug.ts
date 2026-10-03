import { createFileRoute } from "@tanstack/react-router";

/** Delivery page button: counts the click, then redirects to the saved link. */
export const Route = createFileRoute("/api/public/pg/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!/^[a-z0-9-]{3,60}$/.test(params.slug)) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: p } = await supabaseAdmin.from("delivery_pages").select("id, organization_id, button_url")
          .eq("slug", params.slug).eq("active", true).maybeSingle();
        if (!p?.button_url || !/^https:\/\//i.test(p.button_url)) return new Response("Not found", { status: 404 });
        await supabaseAdmin.from("revenue_events").insert({ organization_id: p.organization_id, kind: "page_click", ref_id: p.id });
        return new Response(null, { status: 302, headers: { Location: p.button_url } });
      },
    },
  },
});
