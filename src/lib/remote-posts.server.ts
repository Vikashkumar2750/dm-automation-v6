/**
 * Fetches posts straight from the connected Instagram / Facebook / YouTube
 * accounts of an organization (all pages, up to a safety cap), so rules can
 * target posts that were never published from this app. Read-only.
 */

import { postThumbnail, youtubeThumbnail } from "@/lib/post-thumbnail";

const GRAPH = "https://graph.facebook.com/v21.0";
const YT = "https://www.googleapis.com/youtube/v3";

export type RemotePost = {
  id: string;
  externalPostId: string;
  socialAccountId: string;
  platform: "instagram" | "facebook" | "youtube";
  accountName: string;
  caption: string;
  mediaUrl: string | null;
  mediaType: string | null;
  permalink: string | null;
  publishedAt: string | null;
};

type AccountRow = { id: string; platform: string; external_id: string; name: string | null };

async function getJson(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(url, init);
    return (await res.json()) as Record<string, unknown>;
  } catch (err) {
    return { error: { message: err instanceof Error ? err.message : "Network error" } };
  }
}

const errOf = (j: Record<string, unknown>) =>
  (j["error"] as { message?: string } | undefined)?.message;

export async function fetchRemotePosts(
  admin: import("@supabase/supabase-js").SupabaseClient,
  organizationId: string,
  maxPerAccount = 500,
): Promise<{ posts: RemotePost[]; warnings: string[] }> {
  const { data: accounts } = await admin
    .from("social_accounts")
    .select("id, platform, external_id, name")
    .eq("organization_id", organizationId)
    .in("platform", ["instagram", "facebook", "youtube"]);

  const rows = (accounts ?? []) as AccountRow[];
  if (rows.length === 0) return { posts: [], warnings: [] };

  const { data: tokens } = await admin
    .from("social_account_tokens")
    .select("social_account_id, access_token")
    .in("social_account_id", rows.map((r) => r.id));
  const { readToken } = await import("@/lib/token-crypto.server");
  const tokenBy = new Map(
    await Promise.all(((tokens ?? []) as { social_account_id: string; access_token: string }[]).map(async (t) => [
      t.social_account_id,
      (await readToken(t.access_token)) ?? "",
    ] as const)),
  );

  const warnings: string[] = [];
  const posts: RemotePost[] = [];

  await Promise.all(
    rows.map(async (account) => {
      const label = account.name || account.platform;
      const base = { socialAccountId: account.id, accountName: label };

      if (account.platform === "youtube") {
        const { freshYouTubeToken } = await import("@/lib/youtube-automation.server");
        const token = await freshYouTubeToken(admin, account.id).catch(() => null);
        if (!token) return void warnings.push(`${label}: reconnect this account to load its videos.`);
        const auth = { headers: { authorization: `Bearer ${token}` } };
        const ch = await getJson(`${YT}/channels?part=contentDetails&id=${encodeURIComponent(account.external_id)}`, auth);
        const uploads = (ch["items"] as { contentDetails?: { relatedPlaylists?: { uploads?: string } } }[] | undefined)?.[0]
          ?.contentDetails?.relatedPlaylists?.uploads;
        if (!uploads) return void warnings.push(`${label}: ${errOf(ch) ?? "could not load videos"}`);
        let pageToken: string | null = null;
        let count = 0;
        do {
          const params = new URLSearchParams({ part: "snippet", maxResults: "50", playlistId: uploads, ...(pageToken ? { pageToken } : {}) });
          const j = await getJson(`${YT}/playlistItems?${params}`, auth);
          if (j["error"]) { warnings.push(`${label}: ${errOf(j)}`); break; }
          for (const it of (j["items"] ?? []) as { snippet?: { title?: string; publishedAt?: string; resourceId?: { videoId?: string }; thumbnails?: Record<string, { url?: string }> } }[]) {
            const vid = it.snippet?.resourceId?.videoId;
            if (!vid) continue;
            count++;
            const th = it.snippet?.thumbnails;
            posts.push({
              ...base,
              id: `${account.id}:${vid}`,
              externalPostId: vid,
              platform: "youtube",
              caption: (it.snippet?.title ?? "").slice(0, 200),
              mediaUrl: th?.["high"]?.url ?? th?.["medium"]?.url ?? th?.["default"]?.url ?? youtubeThumbnail(vid),
              mediaType: "VIDEO",
              permalink: `https://www.youtube.com/watch?v=${vid}`,
              publishedAt: it.snippet?.publishedAt ?? null,
            });
          }
          pageToken = (j["nextPageToken"] as string | undefined) ?? null;
        } while (pageToken && count < maxPerAccount);
        return;
      }

      const token = tokenBy.get(account.id);
      if (!token) return void warnings.push(`${label}: reconnect this account to load its posts.`);
      const qs = `access_token=${encodeURIComponent(token)}&limit=100`;
      let url: string | null =
        account.platform === "instagram"
          ? `${GRAPH}/${account.external_id}/media?fields=id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp&${qs}`
          : `${GRAPH}/${account.external_id}/posts?fields=id,message,story,full_picture,permalink_url,created_time&${qs}`;
      let count = 0;
      while (url && count < maxPerAccount) {
        const j = await getJson(url);
        if (j["error"]) { warnings.push(`${label}: ${errOf(j) ?? "could not load posts"}`); break; }
        for (const item of (j["data"] ?? []) as Record<string, string | undefined>[]) {
          if (!item["id"]) continue;
          count++;
          posts.push({
            ...base,
            id: `${account.id}:${item["id"]}`,
            externalPostId: item["id"],
            platform: account.platform as "instagram" | "facebook",
            caption: (item["caption"] ?? item["message"] ?? item["story"] ?? "").slice(0, 200),
            mediaUrl: postThumbnail(item),
            mediaType: item["media_product_type"] === "REELS" ? "REELS" : item["media_type"] ?? null,
            permalink: item["permalink"] ?? item["permalink_url"] ?? null,
            publishedAt: item["timestamp"] ?? item["created_time"] ?? null,
          });
        }
        url = ((j["paging"] as { next?: string } | undefined)?.next) ?? null;
      }
    }),
  );

  posts.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  return { posts, warnings };
}
