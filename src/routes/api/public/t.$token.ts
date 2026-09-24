import { createFileRoute } from "@tanstack/react-router";

import { readToken } from "@/lib/click-tracking.server";

const BOT = /facebookexternalhit|facebot|bot|crawler|spider|preview|whatsapp|slurp/i;

export const Route = createFileRoute("/api/public/t/$token")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const p = readToken(params.token);
        if (!p) return new Response("Link expired", { status: 404 });
        const ua = request.headers.get("user-agent") ?? "";
        if (!BOT.test(ua)) {
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            // Dedupe: one click entry per contact/kind per 10 minutes.
            const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
            let q = supabaseAdmin
              .from("automation_runs")
              .select("id", { count: "exact", head: true })
              .eq("organization_id", p.o)
              .eq("detail", `click:${p.k}`)
              .gte("created_at", since);
            q = p.c ? q.eq("conversation_id", p.c) : q.is("conversation_id", null);
            const { count } = await q;
            if (!count) {
              await supabaseAdmin.from("automation_runs").insert({
                organization_id: p.o,
                rule_id: p.r,
                conversation_id: p.c,
                status: "matched",
                detail: `click:${p.k}`,
              });
            }
          } catch (e) {
            console.error("click tracking failed", e);
          }
        }
        return new Response(null, { status: 302, headers: { Location: p.u, "Cache-Control": "no-store" } });
      },
    },
  },
});
