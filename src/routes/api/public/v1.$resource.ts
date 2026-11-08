import { createFileRoute } from "@tanstack/react-router";

/** Read-only public API. Auth: X-API-Key header (workspace key from Team desk → API & webhooks). */
export const Route = createFileRoute("/api/public/v1/$resource")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { authenticateApiKey } = await import("@/lib/team-desk.server");
        const { clampLimit } = await import("@/lib/team-desk");
        const auth = await authenticateApiKey(request);
        if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const url = new URL(request.url);
        const limit = clampLimit(url.searchParams.get("limit"));
        const org = auth.organizationId;

        if (params.resource === "conversations") {
          const { data, error } = await supabaseAdmin
            .from("conversations")
            .select("id, platform, channel, status, external_user_id, external_user_name, last_message_at, last_message_preview, unread_count")
            .eq("organization_id", org)
            .order("last_message_at", { ascending: false })
            .limit(limit);
          if (error) return Response.json({ error: "data_unavailable" }, { status: 503 });
          return Response.json({ data: data ?? [] });
        }
        if (params.resource === "messages") {
          const conv = url.searchParams.get("conversation_id") ?? "";
          if (!/^[0-9a-f-]{36}$/i.test(conv)) return Response.json({ error: "conversation_id required" }, { status: 400 });
          const { data, error } = await supabaseAdmin
            .from("messages")
            .select("id, direction, body, sender_name, sent_at, conversations!inner(organization_id)")
            .eq("conversation_id", conv)
            .eq("conversations.organization_id", org)
            .order("sent_at", { ascending: false })
            .limit(limit);
          if (error) return Response.json({ error: "data_unavailable" }, { status: 503 });
          return Response.json({ data: (data ?? []).map(({ conversations: _c, ...m }) => m) });
        }
        if (params.resource === "contacts") {
          const { data, error } = await supabaseAdmin
            .from("contact_profiles")
            .select("*")
            .eq("organization_id", org)
            .limit(limit);
          if (error) return Response.json({ error: "data_unavailable" }, { status: 503 });
          return Response.json({ data: data ?? [] });
        }
        return Response.json({ error: "not_found" }, { status: 404 });
      },
    },
  },
});
