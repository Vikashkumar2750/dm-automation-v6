/**
 * Fetches the most recent posts straight from the Meta Graph API for every
 * connected Instagram / Facebook account of an organization, so automation
 * rules can be targeted at posts that were never published from this app.
 */

const GRAPH = "https://graph.facebook.com/v21.0";

export type RemotePost = {
  id: string;
  externalPostId: string;
  platform: "instagram" | "facebook";
  accountName: string;
  caption: string;
  mediaUrl: string | null;
  permalink: string | null;
  publishedAt: string | null;
};

type AccountRow = {
  id: string;
  platform: string;
  external_id: string;
  name: string | null;
};

async function graphGet(url: string): Promise<{ data?: unknown[]; error?: { message?: string } }> {
  try {
    const res = await fetch(url);
    return (await res.json()) as { data?: unknown[]; error?: { message?: string } };
  } catch (err) {
    return { error: { message: err instanceof Error ? err.message : "Network error" } };
  }
}

export async function fetchRemotePosts(
  admin: import("@supabase/supabase-js").SupabaseClient,
  organizationId: string,
  limit = 20,
): Promise<{ posts: RemotePost[]; warnings: string[] }> {
  const { data: accounts } = await admin
    .from("social_accounts")
    .select("id, platform, external_id, name")
    .eq("organization_id", organizationId)
    .in("platform", ["instagram", "facebook"]);

  const rows = (accounts ?? []) as AccountRow[];
  if (rows.length === 0) return { posts: [], warnings: [] };

  const { data: tokens } = await admin
    .from("social_account_tokens")
    .select("social_account_id, access_token")
    .in(
      "social_account_id",
      rows.map((r) => r.id),
    );
  const tokenBy = new Map(
    ((tokens ?? []) as { social_account_id: string; access_token: string }[]).map((t) => [
      t.social_account_id,
      t.access_token,
    ]),
  );

  const warnings: string[] = [];
  const posts: RemotePost[] = [];

  await Promise.all(
    rows.map(async (account) => {
      const token = tokenBy.get(account.id);
      const label = account.name || account.platform;
      if (!token) {
        warnings.push(`${label}: reconnect this account to load its posts.`);
        return;
      }
      const qs = `access_token=${encodeURIComponent(token)}&limit=${limit}`;
      const url =
        account.platform === "instagram"
          ? `${GRAPH}/${account.external_id}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&${qs}`
          : `${GRAPH}/${account.external_id}/posts?fields=id,message,story,full_picture,permalink_url,created_time&${qs}`;

      const json = await graphGet(url);
      if (json.error) {
        warnings.push(`${label}: ${json.error.message ?? "could not load posts"}`);
        return;
      }
      for (const item of (json.data ?? []) as Record<string, string | undefined>[]) {
        if (!item['id']) continue;
        posts.push({
          id: `${account.id}:${item['id']}`,
          externalPostId: item['id'],
          platform: account.platform as "instagram" | "facebook",
          accountName: label,
          caption: (item['caption'] ?? item['message'] ?? item['story'] ?? "").slice(0, 200),
          mediaUrl: item['media_url'] ?? item['thumbnail_url'] ?? item['full_picture'] ?? null,
          permalink: item['permalink'] ?? item['permalink_url'] ?? null,
          publishedAt: item['timestamp'] ?? item['created_time'] ?? null,
        });
      }
    }),
  );

  posts.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  return { posts, warnings };
}
