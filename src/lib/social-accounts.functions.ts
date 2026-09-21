import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SocialAccountRow, SocialPlatform } from "@/lib/social";

const orgInput = z.object({ organizationId: z.string().uuid() });

export const listSocialAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => orgInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("social_accounts")
      .select(
        "id, platform, external_id, name, handle, avatar_url, status, scopes, token_expires_at, last_synced_at, created_at",
      )
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as SocialAccountRow[];
  });

/** Google OAuth credentials, accepting either secret naming convention. */
export function googleCredentials() {
  return {
    clientId: process.env["GOOGLE_OAUTH_CLIENT_ID"] ?? process.env["YOUTUBE_CLIENT_ID"],
    clientSecret:
      process.env["GOOGLE_OAUTH_CLIENT_SECRET"] ?? process.env["YOUTUBE_CLIENT_SECRET"],
  };
}

/** Which providers have credentials configured on the server. */
export const getProviderReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const google = googleCredentials();
    return {
      meta: Boolean(process.env["META_APP_ID"] && process.env["META_APP_SECRET"]),
      google: Boolean(google.clientId && google.clientSecret),
    };
  });

export const disconnectSocialAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("social_accounts")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Creates a one-time OAuth state row and returns the provider consent URL. */
export const startSocialConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        platform: z.enum(["instagram", "facebook", "youtube"]),
        origin: z.string().url(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    // Only owners/admins/managers may connect accounts — enforced by RLS on insert too.
    const { data: membership } = await context.supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", data.organizationId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!membership || !["owner", "admin", "manager"].includes(membership.role)) {
      return { error: "not_allowed" as const };
    }

    const platform = data.platform as SocialPlatform;
    const provider = platform === "youtube" ? "google" : "meta";

    const google = googleCredentials();
    const clientId = provider === "meta" ? process.env["META_APP_ID"] : google.clientId;
    const clientSecret =
      provider === "meta" ? process.env["META_APP_SECRET"] : google.clientSecret;
    if (!clientId || !clientSecret) return { error: "missing_credentials" as const };

    const state = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("oauth_states").insert({
      state,
      organization_id: data.organizationId,
      user_id: context.userId,
      platform,
      redirect_path: "/social-accounts",
    });
    if (error) throw new Error(error.message);

    const redirectUri = `${data.origin}/api/public/oauth/${provider}/callback`;
    const { metaScopes, googleScopes } = await import("@/lib/social");

    const url =
      provider === "meta"
        ? `https://www.facebook.com/v21.0/dialog/oauth?${new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            state,
            response_type: "code",
            scope: metaScopes.join(","),
          }).toString()}`
        : `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            state,
            response_type: "code",
            access_type: "offline",
            include_granted_scopes: "true",
            prompt: "consent",
            scope: googleScopes.join(" "),
          }).toString()}`;

    return { url };
  });
