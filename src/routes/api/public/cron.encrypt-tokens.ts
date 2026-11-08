import { createFileRoute } from "@tanstack/react-router";

/** Scheduler endpoint: seals legacy plaintext tokens (no-op without TOKEN_ENCRYPTION_KEY). Cron-secret protected. */
export const Route = createFileRoute("/api/public/cron/encrypt-tokens")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { cronAuthFailure } = await import("@/lib/cron-secret.server");
        const denied = cronAuthFailure(request, "/api/public/cron/encrypt-tokens");
        if (denied) return denied;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { backfillEncryptedTokens } = await import("@/lib/token-backfill.server");
        try {
          const result = await backfillEncryptedTokens(supabaseAdmin);
          return Response.json(result);
        } catch {
          return Response.json({ error: "Encryption verification failed. Check hosting configuration and database access." }, { status: 503 });
        }
      },
    },
  },
});
