import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/offer/$token")({ server: { handlers: { GET: async ({ params }) => {
  if (!/^[0-9a-f-]{36}$/.test(params.token)) return new Response("Not found", { status: 404 });
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: link } = await supabaseAdmin.from("payment_links").select("id, organization_id, url, delivery_pages!inner(id, active, countdown_at, expiry_action)")
    .eq("offer_token", params.token).maybeSingle();
  const page = Array.isArray(link?.delivery_pages) ? link?.delivery_pages[0] : link?.delivery_pages;
  if (!link?.url || !page?.active || !/^https:\/\//i.test(link.url)) return new Response("Not found", { status: 404 });
  if (page.countdown_at && page.expiry_action && new Date(page.countdown_at) <= new Date()) return new Response("Offer ended", { status: 410 });
  await supabaseAdmin.from("revenue_events").insert({ organization_id: link.organization_id, kind: "page_click", ref_id: link.id });
  return new Response(null, { status: 302, headers: { Location: link.url, "Cache-Control": "no-store" } });
} } } });