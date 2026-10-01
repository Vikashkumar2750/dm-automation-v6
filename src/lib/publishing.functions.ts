import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const WRITE_ROLES = ["owner", "admin", "manager"] as const;

export type Post = {
  id: string;
  organization_id: string;
  social_account_id: string | null;
  platform: "instagram" | "facebook" | "youtube";
  caption: string;
  media_url: string | null;
  media_urls: string[] | null;
  post_format: string;
  group_id: string | null;
  media_type: string;
  scheduled_at: string | null;
  status: "draft" | "scheduled" | "publishing" | "published" | "failed";
  external_post_id: string | null;
  permalink: string | null;
  error: string | null;
  published_at: string | null;
  created_at: string;
};

const SELECT =
  "id, organization_id, social_account_id, platform, caption, media_url, media_urls, post_format, group_id, media_type, scheduled_at, status, external_post_id, permalink, error, published_at, created_at";

async function assertWriter(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  organizationId: string,
  _userId: string,
) {
  const { data: allowed } = await supabase.rpc("current_user_has_org_role", {
    _org_id: organizationId,
    _roles: [...WRITE_ROLES],
  });
  if (!allowed) throw new Error("not_allowed");
}

export const listPosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string }) =>
    z.object({ organizationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("posts")
      .select(SELECT)
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return (rows ?? []) as Post[];
  });

const mediaRef = z
  .string()
  .trim()
  .max(1000)
  .refine((value) => value.startsWith("storage:") || /^https?:\/\//.test(value), {
    message: "Media must be an uploaded file or a public link",
  });

const postInput = z.object({
  id: z.string().uuid().optional(),
  organizationId: z.string().uuid(),
  /** One post is created per selected account — publish everywhere at once. */
  socialAccountIds: z.array(z.string().uuid()).min(1).max(20),
  caption: z.string().trim().max(2200),
  media: z.array(mediaRef).max(10),
  mediaType: z.enum(["image", "video"]),
  postFormat: z.enum(["feed", "reel", "story", "carousel", "trial_reel"]),
  scheduledAt: z.string().datetime().nullable(),
  status: z.enum(["draft", "scheduled"]),
  alsoStory: z.boolean().optional().default(false),
});

export const savePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof postInput>) => postInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertWriter(context.supabase, data.organizationId, context.userId);
    if (data.status === "scheduled" && !data.scheduledAt) {
      throw new Error("A scheduled post needs a date and time");
    }
    if (!data.caption.trim() && data.media.length === 0) {
      throw new Error("Add a caption or some media");
    }
    if (data.postFormat === "carousel" && data.media.length < 2) {
      throw new Error("A carousel needs at least 2 photos");
    }
    if ((data.postFormat === "reel" || data.postFormat === "story") && data.media.length === 0) {
      throw new Error("Reels and stories need a video or photo");
    }

    const { data: accounts, error: accountError } = await context.supabase
      .from("social_accounts")
      .select("id, platform")
      .eq("organization_id", data.organizationId)
      .in("id", data.socialAccountIds);
    if (accountError) throw new Error(accountError.message);
    const targets = (accounts ?? []) as {
      id: string;
      platform: "instagram" | "facebook" | "youtube";
    }[];
    if (targets.length === 0) throw new Error("Pick at least one connected account");

    const base = {
      organization_id: data.organizationId,
      caption: data.caption,
      media_url: data.media[0] ?? null,
      media_urls: data.media,
      media_type: data.mediaType,
      post_format: data.postFormat,
      scheduled_at: data.scheduledAt,
      status: data.status,
      error: null,
    };

    if (data.id) {
      const first = targets[0]!;
      const { error } = await context.supabase
        .from("posts")
        .update({ ...base, social_account_id: first.id, platform: first.platform })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ids: [data.id] };
    }

    const groupId = crypto.randomUUID();
    const wantsStory = data.alsoStory && (data.postFormat === "feed" || data.postFormat === "reel" || data.postFormat === "trial_reel");
    const useGroup = targets.length > 1 || wantsStory;
    const rows = targets.map((account) => ({
      ...base,
      // Trial reels exist on Instagram only; other platforms get a normal reel.
      post_format: data.postFormat === "trial_reel" && account.platform !== "instagram" ? "reel" : data.postFormat,
      social_account_id: account.id,
      platform: account.platform,
      group_id: useGroup ? groupId : null,
      created_by: context.userId,
    }));

    const { data: created, error } = await context.supabase
      .from("posts")
      .insert(rows)
      .select("id");
    if (error) throw new Error(error.message);
    const ids = ((created ?? []) as { id: string }[]).map((row) => row.id);

    // Optional story copies: first media only, no caption (stories don't show captions).
    let storyIds: string[] = [];
    const storyTargets = targets.filter((a) => a.platform === "instagram" || a.platform === "facebook");
    if (wantsStory && storyTargets.length > 0 && data.media.length > 0) {
      const storyRows = storyTargets.map((account) => ({
        ...base,
        caption: "",
        media_url: data.media[0]!,
        media_urls: [data.media[0]!],
        post_format: "story",
        social_account_id: account.id,
        platform: account.platform,
        group_id: groupId,
        created_by: context.userId,
      }));
      const { data: stories, error: storyError } = await context.supabase
        .from("posts")
        .insert(storyRows)
        .select("id");
      if (storyError) throw new Error(storyError.message);
      storyIds = ((stories ?? []) as { id: string }[]).map((row) => row.id);
    }
    return { ids, storyIds };
  });

export const deletePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("posts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Reschedule a post to a new time (used by the calendar). */
export const reschedulePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; scheduledAt: string }) =>
    z
      .object({ id: z.string().uuid(), scheduledAt: z.string().datetime() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("posts")
      .update({ scheduled_at: data.scheduledAt, status: "scheduled", error: null })
      .eq("id", data.id)
      .in("status", ["draft", "scheduled", "failed"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const publishNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: post } = await context.supabase
      .from("posts")
      .select("id, organization_id")
      .eq("id", data.id)
      .single();
    if (!post) throw new Error("Post not found");
    await assertWriter(
      context.supabase,
      (post as { organization_id: string }).organization_id,
      context.userId,
    );

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { publishPost } = await import("./publishing.server");
    const result = await publishPost(supabaseAdmin, data.id);
    if (!result.ok) throw new Error(result.error);
    return result;
  });

/** Flush any posts whose time has passed for this workspace (called when the UI loads). */
export const runDuePosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string }) =>
    z.object({ organizationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: member } = await context.supabase.rpc("current_user_is_org_member", {
      _org_id: data.organizationId,
    });
    if (!member) throw new Error("not_allowed");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { publishDuePosts } = await import("./publishing.server");
    return publishDuePosts(supabaseAdmin, data.organizationId);
  });
