import { createFileRoute } from "@tanstack/react-router";

type StateRow = {
  state: string;
  organization_id: string;
  user_id: string;
  platform: "instagram" | "facebook" | "youtube";
  redirect_path: string;
  expires_at: string;
};

function backTo(origin: string, path: string, params: Record<string, string>) {
  const url = new URL(path, origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Response(null, { status: 302, headers: { location: url.toString() } });
}

function publicOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (!forwardedHost) return requestUrl.origin;

  const protocol = forwardedProto === "http" ? "http" : "https";
  return `${protocol}://${forwardedHost}`;
}

export const Route = createFileRoute("/api/public/oauth/$provider/callback")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        // Railway terminates HTTPS before forwarding the request. Rebuild the
        // browser-facing origin so Meta receives the same redirect_uri during
        // authorization and code exchange.
        const origin = publicOrigin(request);
        const provider = params.provider;
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");

        if (provider !== "meta" && provider !== "google") {
          return new Response("Unknown provider", { status: 404 });
        }
        if (!state) return backTo(origin, "/social-accounts", { connect: "error" });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: stateRow } = await supabaseAdmin
          .from("oauth_states")
          .select("*")
          .eq("state", state)
          .maybeSingle<StateRow>();
        await supabaseAdmin.from("oauth_states").delete().eq("state", state);

        if (!stateRow || new Date(stateRow.expires_at) < new Date()) {
          return backTo(origin, "/social-accounts", { connect: "expired" });
        }
        const redirectPath = stateRow.redirect_path || "/social-accounts";
        if (!code) return backTo(origin, redirectPath, { connect: "cancelled" });

        const redirectUri = `${origin}/api/public/oauth/${provider}/callback`;

        try {
          const connected =
            provider === "meta"
              ? await connectMeta({ code, redirectUri, stateRow, supabaseAdmin })
              : await connectGoogle({ code, redirectUri, stateRow, supabaseAdmin });

          return backTo(origin, redirectPath, {
            connect: "success",
            added: String(connected),
          });
        } catch (error) {
          console.error("OAuth callback failed", error);
          return backTo(origin, redirectPath, { connect: "error" });
        }
      },
    },
  },
});

type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

async function saveAccount(
  supabaseAdmin: AdminClient,
  stateRow: StateRow,
  account: {
    platform: "instagram" | "facebook" | "youtube";
    external_id: string;
    name: string;
    handle?: string | null;
    avatar_url?: string | null;
    scopes: string[];
    metadata?: Record<string, string | number | boolean | null>;
    access_token: string;
    refresh_token?: string | null;
    expires_at?: string | null;
  },
) {
  const { data: row, error } = await supabaseAdmin
    .from("social_accounts")
    .upsert(
      {
        organization_id: stateRow.organization_id,
        platform: account.platform,
        external_id: account.external_id,
        name: account.name,
        handle: account.handle ?? null,
        avatar_url: account.avatar_url ?? null,
        status: "connected",
        scopes: account.scopes,
        metadata: account.metadata ?? {},
        token_expires_at: account.expires_at ?? null,
        last_synced_at: new Date().toISOString(),
        connected_by: stateRow.user_id,
      },
      { onConflict: "organization_id,platform,external_id" },
    )
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { error: tokenError } = await supabaseAdmin.from("social_account_tokens").upsert({
    social_account_id: row.id,
    access_token: account.access_token,
    refresh_token: account.refresh_token ?? null,
    expires_at: account.expires_at ?? null,
  });
  if (tokenError) throw new Error(tokenError.message);
}

async function connectMeta(args: {
  code: string;
  redirectUri: string;
  stateRow: StateRow;
  supabaseAdmin: AdminClient;
}) {
  const { code, redirectUri, stateRow, supabaseAdmin } = args;
  const appId = process.env["META_APP_ID"]!;
  const appSecret = process.env["META_APP_SECRET"]!;

  const tokenRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?${new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    })}`,
  );
  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: unknown;
  };
  if (!tokenJson.access_token) throw new Error(JSON.stringify(tokenJson));

  // Exchange for a long-lived user token.
  const longRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?${new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: tokenJson.access_token,
    })}`,
  );
  const longJson = (await longRes.json()) as { access_token?: string; expires_in?: number };
  const userToken = longJson.access_token ?? tokenJson.access_token;
  const expiresAt = longJson.expires_in
    ? new Date(Date.now() + longJson.expires_in * 1000).toISOString()
    : null;

  const pagesRes = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?${new URLSearchParams({
      fields:
        "id,name,username,access_token,picture{url},instagram_business_account{id,username,name,profile_picture_url}",
      access_token: userToken,
    })}`,
  );
  const pagesJson = (await pagesRes.json()) as {
    data?: Array<{
      id: string;
      name: string;
      username?: string;
      access_token: string;
      picture?: { data?: { url?: string } };
      instagram_business_account?: {
        id: string;
        username?: string;
        name?: string;
        profile_picture_url?: string;
      };
    }>;
    error?: unknown;
  };
  if (!pagesJson.data) throw new Error(JSON.stringify(pagesJson));

  const { metaScopes } = await import("@/lib/social");
  const { subscribeInstagramWebhooks, subscribePageWebhooks } = await import(
    "@/lib/meta-webhooks.server"
  );
  let saved = 0;

  for (const page of pagesJson.data) {
    if (stateRow.platform === "facebook" || stateRow.platform === "instagram") {
      // Install the app on the Page so Meta actually delivers comment/DM webhooks.
      const sub = await subscribePageWebhooks(page.id, page.access_token);
      if (!sub.ok) console.error("page webhook subscribe failed", page.id, sub.error);
      if (stateRow.platform === "facebook") {
        await saveAccount(supabaseAdmin, stateRow, {
          platform: "facebook",
          external_id: page.id,
          name: page.name,
          handle: page.username ?? null,
          avatar_url: page.picture?.data?.url ?? null,
          scopes: metaScopes,
          metadata: { page_id: page.id, webhook_subscribed: sub.ok },
          access_token: page.access_token,
          expires_at: expiresAt,
        });
        saved++;
      } else if (page.instagram_business_account) {
        const ig = page.instagram_business_account;
        const igSub = await subscribeInstagramWebhooks(ig.id, page.access_token);
        if (!igSub.ok) {
          console.error("instagram webhook subscribe failed", ig.id, igSub.error);
        }
        await saveAccount(supabaseAdmin, stateRow, {
          platform: "instagram",
          external_id: ig.id,
          name: ig.name ?? ig.username ?? page.name,
          handle: ig.username ? `@${ig.username}` : null,
          avatar_url: ig.profile_picture_url ?? null,
          scopes: metaScopes,
          metadata: {
            page_id: page.id,
            ig_user_id: ig.id,
            webhook_subscribed: sub.ok && igSub.ok,
          },
          access_token: page.access_token,
          expires_at: expiresAt,
        });
        saved++;
      }
    }
  }

  return saved;
}

async function connectGoogle(args: {
  code: string;
  redirectUri: string;
  stateRow: StateRow;
  supabaseAdmin: AdminClient;
}) {
  const { code, redirectUri, stateRow, supabaseAdmin } = args;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: (process.env["GOOGLE_OAUTH_CLIENT_ID"] ??
        process.env["YOUTUBE_CLIENT_ID"])!,
      client_secret: (process.env["GOOGLE_OAUTH_CLIENT_SECRET"] ??
        process.env["YOUTUBE_CLIENT_SECRET"])!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!tokenJson.access_token) throw new Error(JSON.stringify(tokenJson));

  const channelRes = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
    { headers: { authorization: `Bearer ${tokenJson.access_token}` } },
  );
  const channelJson = (await channelRes.json()) as {
    items?: Array<{
      id: string;
      snippet?: {
        title?: string;
        customUrl?: string;
        thumbnails?: { default?: { url?: string } };
      };
      statistics?: { subscriberCount?: string };
    }>;
  };
  const channel = channelJson.items?.[0];
  if (!channel) throw new Error("No YouTube channel on this Google account");

  const { googleScopes } = await import("@/lib/social");
  await saveAccount(supabaseAdmin, stateRow, {
    platform: "youtube",
    external_id: channel.id,
    name: channel.snippet?.title ?? "YouTube channel",
    handle: channel.snippet?.customUrl ?? null,
    avatar_url: channel.snippet?.thumbnails?.default?.url ?? null,
    scopes: googleScopes,
    metadata: { subscribers: channel.statistics?.subscriberCount ?? null },
    access_token: tokenJson.access_token,
    refresh_token: tokenJson.refresh_token ?? null,
    expires_at: tokenJson.expires_in
      ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
      : null,
  });

  return 1;
}
