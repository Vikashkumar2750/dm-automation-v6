/**
 * Publishing engine (Phase 11).
 * Publishes a scheduled/draft post to Instagram or Facebook via the Graph API.
 * Runs with the service-role client (tokens live in social_account_tokens).
 */

type AdminClient = import("@supabase/supabase-js").SupabaseClient;

const GRAPH = "https://graph.facebook.com/v21.0";

export type PublishResult =
  | { ok: true; externalId: string; permalink: string | null }
  | { ok: false; error: string };

type PostRow = {
  id: string;
  organization_id: string;
  social_account_id: string | null;
  platform: string;
  caption: string;
  media_url: string | null;
  media_type: string;
  status: string;
};

async function graph(
  url: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const errored = Boolean((data as { error?: unknown }).error);
  return { ok: response.ok && !errored, data };
}

function graphError(data: Record<string, unknown>): string {
  const err = (data as { error?: { message?: string } }).error;
  return err?.message ?? "The platform rejected this post";
}

/** Publish a single post row. Never throws — always returns a result. */
export async function publishPost(
  admin: AdminClient,
  postId: string,
): Promise<PublishResult> {
  const { data: post } = (await admin
    .from("posts")
    .select(
      "id, organization_id, social_account_id, platform, caption, media_url, media_type, status",
    )
    .eq("id", postId)
    .single()) as { data: PostRow | null };

  if (!post) return { ok: false, error: "Post not found" };
  if (post.status === "published") {
    return { ok: false, error: "Already published" };
  }
  if (post.platform === "youtube") {
    return { ok: false, error: "YouTube publishing arrives in the next phase" };
  }
  if (!post.social_account_id) {
    return { ok: false, error: "No connected account selected for this post" };
  }

  // Claim the post so two runners never publish it twice.
  const { data: claimed } = await admin
    .from("posts")
    .update({ status: "publishing", error: null })
    .eq("id", post.id)
    .in("status", ["draft", "scheduled", "failed"])
    .select("id");
  if (!claimed || claimed.length === 0) {
    return { ok: false, error: "Post is already being published" };
  }

  const fail = async (error: string): Promise<PublishResult> => {
    await admin.from("posts").update({ status: "failed", error }).eq("id", post.id);
    return { ok: false, error };
  };

  const [{ data: tokenRow }, { data: account }] = await Promise.all([
    admin
      .from("social_account_tokens")
      .select("access_token")
      .eq("social_account_id", post.social_account_id)
      .maybeSingle(),
    admin
      .from("social_accounts")
      .select("external_id, platform")
      .eq("id", post.social_account_id)
      .maybeSingle(),
  ]);
  const token = (tokenRow as { access_token?: string } | null)?.access_token;
  const externalAccountId = (account as { external_id?: string } | null)?.external_id;
  if (!token || !externalAccountId) {
    return fail("This account needs to be reconnected before publishing");
  }

  try {
    if (post.platform === "instagram") {
      if (!post.media_url) {
        return fail("Instagram posts need an image or video link");
      }
      const container = await graph(`${GRAPH}/${externalAccountId}/media`, {
        ...(post.media_type === "video"
          ? { video_url: post.media_url, media_type: "REELS" }
          : { image_url: post.media_url }),
        caption: post.caption,
        access_token: token,
      });
      if (!container.ok) return fail(graphError(container.data));
      const creationId = String((container.data as { id?: string }).id ?? "");
      if (!creationId) return fail("Instagram did not return a media container");

      const publish = await graph(`${GRAPH}/${externalAccountId}/media_publish`, {
        creation_id: creationId,
        access_token: token,
      });
      if (!publish.ok) return fail(graphError(publish.data));
      const externalId = String((publish.data as { id?: string }).id ?? creationId);

      await admin
        .from("posts")
        .update({
          status: "published",
          external_post_id: externalId,
          published_at: new Date().toISOString(),
          error: null,
        })
        .eq("id", post.id);
      return { ok: true, externalId, permalink: null };
    }

    // Facebook page post
    const url = post.media_url
      ? `${GRAPH}/${externalAccountId}/photos`
      : `${GRAPH}/${externalAccountId}/feed`;
    const body = post.media_url
      ? { url: post.media_url, caption: post.caption, access_token: token }
      : { message: post.caption, access_token: token };
    const result = await graph(url, body);
    if (!result.ok) return fail(graphError(result.data));
    const raw = result.data as { id?: string; post_id?: string };
    const externalId = String(raw.post_id ?? raw.id ?? "");

    await admin
      .from("posts")
      .update({
        status: "published",
        external_post_id: externalId || null,
        permalink: externalId ? `https://facebook.com/${externalId}` : null,
        published_at: new Date().toISOString(),
        error: null,
      })
      .eq("id", post.id);
    return {
      ok: true,
      externalId,
      permalink: externalId ? `https://facebook.com/${externalId}` : null,
    };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Publishing failed");
  }
}

/** Publish every post whose scheduled time has passed. Used by the cron route and the UI. */
export async function publishDuePosts(
  admin: AdminClient,
  organizationId?: string,
): Promise<{ attempted: number; published: number }> {
  let query = admin
    .from("posts")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(25);
  if (organizationId) query = query.eq("organization_id", organizationId);

  const { data: due } = (await query) as { data: { id: string }[] | null };
  if (!due || due.length === 0) return { attempted: 0, published: 0 };

  let published = 0;
  for (const row of due) {
    const result = await publishPost(admin, row.id);
    if (result.ok) published += 1;
  }
  return { attempted: due.length, published };
}
