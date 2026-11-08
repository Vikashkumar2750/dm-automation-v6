import { createFileRoute } from "@tanstack/react-router";

// Google returns here after the Super Admin approves Drive access.
// Trust comes only from the one-time hashed state created by a verified Super Admin.
export const Route = createFileRoute("/api/public/drive-oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { publicOrigin, completeDriveConnect } = await import("@/lib/drive-oauth.server");
        const origin = publicOrigin(request);
        const url = new URL(request.url);
        const back = (result: string) => new Response(null, { status: 302, headers: { location: `${origin}/admin/database?drive=${encodeURIComponent(result)}`, "cache-control": "no-store" } });
        const state = url.searchParams.get("state") ?? "";
        const code = url.searchParams.get("code") ?? "";
        if (url.searchParams.get("error")) return back("cancelled");
        if (state.length < 32 || state.length > 200 || !code || code.length > 2048) return back("state");
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          return back(await completeDriveConnect(supabaseAdmin, state, code, origin));
        } catch {
          return back("store");
        }
      },
    },
  },
});
