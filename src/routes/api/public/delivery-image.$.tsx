import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/delivery-image/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = params._splat ?? "";
        if (!/^[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/.test(path)) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const orgId = path.split("/")[0];
        const { data: page } = await supabaseAdmin.from("delivery_pages").select("id").eq("organization_id", orgId)
          .eq("image_path", path).eq("show_image", true).eq("active", true).limit(1).maybeSingle();
        if (!page) return new Response("Not found", { status: 404 });
        const { data, error } = await supabaseAdmin.storage.from("delivery-page-images").download(path);
        if (error || !data) return new Response("Not found", { status: 404 });
        return new Response(data, { headers: { "Content-Type": data.type || "image/jpeg", "Cache-Control": "public, max-age=3600" } });
      },
    },
  },
});