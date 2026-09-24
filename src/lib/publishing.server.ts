/**
 * Publishing engine.
 * Publishes a draft/scheduled post to Instagram or Facebook via the Graph API.
 * Supports single image, video, reel, story and carousel posts.
 * Runs with the service-role client (tokens live in social_account_tokens).
 */

type AdminClient = import("@supabase/supabase-js").SupabaseClient;

const GRAPH = "https://graph.facebook.com/v21.0";
const MEDIA_BUCKET = "post-media";
const STORAGE_PREFIX = "storage:";

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
  media_urls: string[] | null;
  media_type: string;
  post_format: string;
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

/** Uploaded files live in a private bucket — sign them so Meta can fetch them. */
async function resolveMedia(admin: AdminClient, refs: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const ref of refs) {
    if (!ref.startsWith(STORAGE_PREFIX)) {
      out.push(ref);
      continue;
    }
    const path = ref.slice(STORAGE_PREFIX.length);
    const { data } = await admin.storage.from(MEDIA_BUCKET).createSignedUrl(path, 3600);
    if (!data?.signedUrl) throw new Error("Could not read the uploaded media file");
    out.push(data.signedUrl);
  }
  return out;
}

function mediaRefs(post: PostRow): string[] {
  const list = (post.media_urls ?? []).filter(Boolean);
  if (list.length > 0) return list;
  return post.media_url ? [post.media_url] : [];
}

/** Publish a single post row. Never throws — always returns a result. */
export async function publishPost(
  admin: AdminClient,
  postId: string,
): Promise<PublishResult> {
  const { data: post } = (await admin
    .from("posts")
    .select(
      "id, organization_id, social_account_id, platform, caption, media_url, media_urls, media_type, post_format, status",
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

  const succeed = async (externalId: string, permalink: string | null) => {
    await admin
      .from("posts")
      .update({
        status: "published",
        external_post_id: externalId || null,
        permalink,
        published_at: new Date().toISOString(),
        error: null,
      })
      .eq("id", post.id);
    return { ok: true as const, externalId, permalink };
  };

  try {
    const media = await resolveMedia(admin, mediaRefs(post));
    const isVideo = post.media_type === "video";
    const format = post.post_format || "feed";

    if (post.platform === "instagram") {
      if (media.length === 0) {
        return fail("Instagram posts need at least one photo or video");
      }

      let creationId = "";

      if (format === "carousel" || media.length > 1) {
        if (media.length > 10) return fail("A carousel can hold at most 10 items");
        const children: string[] = [];
        for (const url of media) {
          const child = await graph(`${GRAPH}/${externalAccountId}/media`, {
            ...(isVideo ? { video_url: url, media_type: "VIDEO" } : { image_url: url }),
            is_carousel_item: true,
            access_token: token,
          });
          if (!child.ok) return fail(graphError(child.data));
          children.push(String((child.data as { id?: string }).id ?? ""));
        }
        const carousel = await graph(`${GRAPH}/${externalAccountId}/media`, {
          media_type: "CAROUSEL",
          children,
          caption: post.caption,
          access_token: token,
        });
        if (!carousel.ok) return fail(graphError(carousel.data));
        creationId = String((carousel.data as { id?: string }).id ?? "");
      } else {
        const url = media[0]!;
        const body: Record<string, unknown> = { access_token: token };
        if (format === "story") {
          body["media_type"] = "STORIES";
          if (isVideo) body["video_url"] = url;
          else body["image_url"] = url;
        } else if (format === "reel" || (isVideo && format === "feed")) {
          body["media_type"] = "REELS";
          body["video_url"] = url;
          body["caption"] = post.caption;
          body["share_to_feed"] = true;
        } else {
          body["image_url"] = url;
          body["caption"] = post.caption;
        }
        const container = await graph(`${GRAPH}/${externalAccountId}/media`, body);
        if (!container.ok) return fail(graphError(container.data));
        creationId = String((container.data as { id?: string }).id ?? "");
      }

      if (!creationId) return fail("Instagram did not return a media container");

      // Videos/reels need processing time before they can be published.
      // Always wait: image containers can also be "not found" if published too fast.
      {
        const ready = await waitForContainer(creationId, token);
        if (!ready.ok) return fail(ready.error);
      }

      const publish = await graph(`${GRAPH}/${externalAccountId}/media_publish`, {
        creation_id: creationId,
        access_token: token,
      });
      if (!publish.ok) return fail(graphError(publish.data));
      const externalId = String((publish.data as { id?: string }).id ?? creationId);
      return succeed(externalId, null);
    }

    // ---- Facebook Page ----
    if (media.length === 0) {
      const result = await graph(`${GRAPH}/${externalAccountId}/feed`, {
        message: post.caption,
        access_token: token,
      });
      if (!result.ok) return fail(graphError(result.data));
      const raw = result.data as { id?: string; post_id?: string };
      const id = String(raw.post_id ?? raw.id ?? "");
      return succeed(id, id ? `https://facebook.com/${id}` : null);
    }

    if (isVideo) {
      const endpoint = format === "reel" ? "videos" : "videos";
      const result = await graph(`${GRAPH}/${externalAccountId}/${endpoint}`, {
        file_url: media[0],
        description: post.caption,
        access_token: token,
      });
      if (!result.ok) return fail(graphError(result.data));
      const id = String((result.data as { id?: string }).id ?? "");
      return succeed(id, id ? `https://facebook.com/${id}` : null);
    }

    if (media.length > 1) {
      // Carousel: upload each photo unpublished, then attach them to one feed post.
      const attached: { media_fbid: string }[] = [];
      for (const url of media) {
        const photo = await graph(`${GRAPH}/${externalAccountId}/photos`, {
          url,
          published: false,
          access_token: token,
        });
        if (!photo.ok) return fail(graphError(photo.data));
        attached.push({ media_fbid: String((photo.data as { id?: string }).id ?? "") });
      }
      const result = await graph(`${GRAPH}/${externalAccountId}/feed`, {
        message: post.caption,
        attached_media: attached,
        access_token: token,
      });
      if (!result.ok) return fail(graphError(result.data));
      const raw = result.data as { id?: string; post_id?: string };
      const id = String(raw.post_id ?? raw.id ?? "");
      return succeed(id, id ? `https://facebook.com/${id}` : null);
    }

    const result = await graph(`${GRAPH}/${externalAccountId}/photos`, {
      url: media[0],
      caption: post.caption,
      access_token: token,
    });
    if (!result.ok) return fail(graphError(result.data));
    const raw = result.data as { id?: string; post_id?: string };
    const id = String(raw.post_id ?? raw.id ?? "");
    return succeed(id, id ? `https://facebook.com/${id}` : null);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Publishing failed");
  }
}

/** Poll an Instagram media container until it finishes processing. */
async function waitForContainer(
  creationId: string,
  token: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const response = await fetch(
      `${GRAPH}/${creationId}?fields=status_code,status&access_token=${encodeURIComponent(token)}`,
    );
    const data = (await response.json().catch(() => ({}))) as {
      status_code?: string;
      status?: string;
    };
    if (data.status_code === "FINISHED") return { ok: true };
    if (data.status_code === "ERROR") {
      return { ok: false, error: data.status ?? "Instagram could not process this video" };
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  return { ok: false, error: "Instagram is still processing this video — try again shortly" };
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
