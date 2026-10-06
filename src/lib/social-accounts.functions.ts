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

    const { trustedOrigin } = await import("@/lib/allowed-origin.server");
    const redirectUri = `${trustedOrigin(data.origin)}/api/public/oauth/${provider}/callback`;
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

/**
 * Checks (and optionally repairs) the Page-level webhook subscription that makes
 * Meta deliver comment and DM events for a connected account.
 */
export const checkWebhookDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ organizationId: z.string().uuid(), repair: z.boolean().optional() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: accounts, error } = await context.supabase
      .from("social_accounts")
      .select("id, platform, external_id, name, metadata")
      .eq("organization_id", data.organizationId)
      .in("platform", ["instagram", "facebook"]);
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const {
      INSTAGRAM_SUBSCRIBED_FIELDS,
      PAGE_SUBSCRIBED_FIELDS,
      readInstagramSubscription,
      readPageSubscription,
      subscribeInstagramWebhooks,
      subscribePageWebhooks,
    } = await import("@/lib/meta-webhooks.server");

    const results: Array<{
      id: string;
      name: string;
      platform: string;
      subscribed: boolean;
      fields: string[];
      missingFields: string[];
      error?: string;
    }> = [];

    for (const account of accounts ?? []) {
      const meta = (account.metadata ?? {}) as Record<string, unknown>;
      const pageId =
        typeof meta["page_id"] === "string" ? (meta["page_id"] as string) : account.external_id;

      const { data: tokenRow } = await supabaseAdmin
        .from("social_account_tokens")
        .select("access_token")
        .eq("social_account_id", account.id)
        .maybeSingle();

      if (tokenRow?.access_token) tokenRow.access_token = (await (await import("@/lib/token-crypto.server")).readToken(tokenRow.access_token)) ?? "";
      if (!tokenRow?.access_token) {
        results.push({
          id: account.id,
          name: account.name,
          platform: account.platform,
          subscribed: false,
          fields: [],
          missingFields:
            account.platform === "instagram"
              ? [...PAGE_SUBSCRIBED_FIELDS, ...INSTAGRAM_SUBSCRIBED_FIELDS]
              : [...PAGE_SUBSCRIBED_FIELDS],
          error: "No stored token — reconnect this account.",
        });
        continue;
      }

      let pageRead = await readPageSubscription(pageId, tokenRow.access_token);
      let instagramRead =
        account.platform === "instagram"
          ? await readInstagramSubscription(account.external_id, tokenRow.access_token)
          : ({ fields: [] } as import("@/lib/meta-webhooks.server").ReadResult);
      // Facebook-Login apps cannot manage per-account Instagram subscriptions;
      // Page subscription + app-level Instagram webhook object covers delivery.
      const igUnsupported = Boolean(instagramRead.unsupported);
      const missingPage = PAGE_SUBSCRIBED_FIELDS.filter((field) => !pageRead.fields.includes(field));
      const missingInstagram =
        account.platform === "instagram" && !igUnsupported
          ? INSTAGRAM_SUBSCRIBED_FIELDS.filter(
              (field) => !instagramRead.fields.includes(field),
            )
          : [];

      const repairErrors: string[] = [];
      if (data.repair && missingPage.length > 0) {
        const sub = await subscribePageWebhooks(pageId, tokenRow.access_token);
        if (!sub.ok) repairErrors.push(`Page: ${sub.error ?? "subscribe failed"}`);
        pageRead = await readPageSubscription(pageId, tokenRow.access_token);
      }
      if (
        data.repair &&
        account.platform === "instagram" &&
        !igUnsupported &&
        missingInstagram.length > 0
      ) {
        const sub = await subscribeInstagramWebhooks(
          account.external_id,
          tokenRow.access_token,
        );
        if (!sub.ok) repairErrors.push(`Instagram: ${sub.error ?? "subscribe failed"}`);
        instagramRead = await readInstagramSubscription(
          account.external_id,
          tokenRow.access_token,
        );
      }

      const fields = [...new Set([...pageRead.fields, ...instagramRead.fields])];
      const missingFields = [
        ...PAGE_SUBSCRIBED_FIELDS.filter((field) => !pageRead.fields.includes(field)),
        ...(account.platform === "instagram" && !igUnsupported
          ? INSTAGRAM_SUBSCRIBED_FIELDS.filter(
              (field) => !instagramRead.fields.includes(field),
            )
          : []),
      ];
      const subscribed = missingFields.length === 0;
      await supabaseAdmin
        .from("social_accounts")
        .update({ metadata: { ...meta, page_id: pageId, webhook_subscribed: subscribed } })
        .eq("id", account.id);

      results.push({
        id: account.id,
        name: account.name,
        platform: account.platform,
        subscribed,
        fields,
        missingFields,
        ...(repairErrors.length > 0
          ? { error: repairErrors.join("; ") }
          : pageRead.error
            ? { error: pageRead.error }
            : instagramRead.error
              ? { error: instagramRead.error }
              : {}),
      });
    }

    return results;
  });
