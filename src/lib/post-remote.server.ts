/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Live actions on already-published posts: delete on the platform, edit the
 * caption, and read public engagement counts. Kept separate from the publish
 * path so publishing behaviour never changes.
 */
type AdminClient = import("@supabase/supabase-js").SupabaseClient;

const GRAPH = "https://graph.facebook.com/v21.0";

export type RemotePostRow = {
  id: string;
  platform: "instagram" | "facebook" | "youtube";
  social_account_id: string | null;
  external_post_id: string | null;
};

export type PostStats = { likes: number | null; comments: number | null; shares: number | null; views: number | null };

async function tokenFor(admin: AdminClient, row: RemotePostRow): Promise<string | null> {
  if (!row.social_account_id) return null;
  if (row.platform === "youtube") {
    const { freshYouTubeToken } = await import("@/lib/youtube-automation.server");
    return freshYouTubeToken(admin, row.social_account_id);
  }
  const { data } = await admin
    .from("social_account_tokens")
    .select("access_token")
    .eq("social_account_id", row.social_account_id)
    .maybeSingle();
  const { readToken } = await import("@/lib/token-crypto.server");
  return (await readToken((data as { access_token?: string } | null)?.access_token)) ?? null;
}

async function json(res: Response): Promise<Record<string, any>> {
  try {
    return (await res.json()) as Record<string, any>;
  } catch {
    return {};
  }
}

function errMsg(body: Record<string, any>, fallback: string) {
  const e = body["error"] as { message?: string } | undefined;
  return e?.message ?? fallback;
}

/** Deletes the post on the platform. Instagram has no delete API. */
export async function deleteRemotePost(
  admin: AdminClient,
  row: RemotePostRow,
): Promise<{ ok: boolean; unsupported?: boolean; error?: string }> {
  if (!row.external_post_id) return { ok: true };
  if (row.platform === "instagram") return { ok: false, unsupported: true };
  const token = await tokenFor(admin, row);
  if (!token) return { ok: false, error: "Reconnect this account to delete the post there" };
  if (row.platform === "facebook") {
    const res = await fetch(`${GRAPH}/${row.external_post_id}?access_token=${encodeURIComponent(token)}`, { method: "DELETE" });
    const body = await json(res);
    if (!res.ok || body["success"] === false) return { ok: false, error: errMsg(body, "Facebook refused the delete") };
    return { ok: true };
  }
  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${encodeURIComponent(row.external_post_id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) return { ok: false, error: errMsg(await json(res), "YouTube refused the delete") };
  return { ok: true };
}

/** Updates the caption of a live post. Only Facebook supports this. */
export async function editRemoteCaption(
  admin: AdminClient,
  row: RemotePostRow,
  caption: string,
): Promise<{ ok: boolean; unsupported?: boolean; error?: string }> {
  if (row.platform !== "facebook" || !row.external_post_id) return { ok: false, unsupported: true };
  const token = await tokenFor(admin, row);
  if (!token) return { ok: false, error: "Reconnect this account to edit the post" };
  const res = await fetch(`${GRAPH}/${row.external_post_id}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ message: caption, access_token: token }),
  });
  const body = await json(res);
  if (!res.ok || body["success"] === false) return { ok: false, error: errMsg(body, "Facebook refused the edit") };
  return { ok: true };
}

/** Updates title, description and tags of a live YouTube video (keeps its category). */
export async function editYouTubeVideo(
  admin: AdminClient,
  row: RemotePostRow,
  details: { title: string; description: string; tags: string[] },
): Promise<{ ok: boolean; error?: string }> {
  if (row.platform !== "youtube" || !row.external_post_id) return { ok: false, error: "Not a YouTube video" };
  const token = await tokenFor(admin, row);
  if (!token) return { ok: false, error: "Reconnect your YouTube account to edit this video" };
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const current = await json(await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${encodeURIComponent(row.external_post_id)}`, { headers }));
  const snippet = (current["items"] as any[] | undefined)?.[0]?.snippet;
  if (!snippet) return { ok: false, error: "Video not found on YouTube" };
  const res = await fetch("https://www.googleapis.com/youtube/v3/videos?part=snippet", {
    method: "PUT",
    headers,
    body: JSON.stringify({
      id: row.external_post_id,
      snippet: { title: details.title, description: details.description, tags: details.tags, categoryId: snippet.categoryId ?? "22" },
    }),
  });
  if (!res.ok) return { ok: false, error: errMsg(await json(res), "YouTube refused the edit") };
  return { ok: true };
}

export async function fetchPostStats(admin: AdminClient, row: RemotePostRow): Promise<PostStats | null> {
  if (!row.external_post_id) return null;
  const token = await tokenFor(admin, row);
  if (!token) return null;
  const empty: PostStats = { likes: null, comments: null, shares: null, views: null };
  try {
    if (row.platform === "instagram") {
      const b = await json(await fetch(`${GRAPH}/${row.external_post_id}?fields=like_count,comments_count&access_token=${encodeURIComponent(token)}`));
      if (b["error"]) return null;
      return { ...empty, likes: Number(b["like_count"] ?? 0), comments: Number(b["comments_count"] ?? 0) };
    }
    if (row.platform === "facebook") {
      const b = await json(await fetch(`${GRAPH}/${row.external_post_id}?fields=shares,likes.summary(true).limit(0),comments.summary(true).limit(0)&access_token=${encodeURIComponent(token)}`));
      if (b["error"]) return null;
      const sum = (k: string) => Number(((b[k] as { summary?: { total_count?: number } })?.summary?.total_count) ?? 0);
      return { ...empty, likes: sum("likes"), comments: sum("comments"), shares: Number((b["shares"] as { count?: number })?.count ?? 0) };
    }
    const b = await json(await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${encodeURIComponent(row.external_post_id)}`, { headers: { Authorization: `Bearer ${token}` } }));
    const s = ((b["items"] as { statistics?: Record<string, string> }[] | undefined)?.[0]?.statistics) ?? null;
    if (!s) return null;
    return { likes: Number(s["likeCount"] ?? 0), comments: Number(s["commentCount"] ?? 0), shares: null, views: Number(s["viewCount"] ?? 0) };
  } catch {
    return null;
  }
}
