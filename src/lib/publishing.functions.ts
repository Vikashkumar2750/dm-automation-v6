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
  "id, organization_id, social_account_id, platform, caption, media_url, media_type, scheduled_at, status, external_post_id, permalink, error, published_at, created_at";

async function assertWriter(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  organizationId: string,
  userId: string,
) {
  const { data: allowed } = await supabase.rpc("has_org_role", {
    _org_id: organizationId,
    _user_id: userId,
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

const postInput = z.object({
  id: z.string().uuid().optional(),
  organizationId: z.string().uuid(),
  socialAccountId: z.string().uuid().nullable(),
  platform: z.enum(["instagram", "facebook", "youtube"]),
  caption: z.string().trim().max(2200),
  mediaUrl: z.string().trim().url().max(1000).nullable(),
  mediaType: z.enum(["image", "video"]),
  scheduledAt: z.string().datetime().nullable(),
  status: z.enum(["draft", "scheduled"]),
});

export const savePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof postInput>) => postInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertWriter(context.supabase, data.organizationId, context.userId);
    if (data.status === "scheduled" && !data.scheduledAt) {
      throw new Error("A scheduled post needs a date and time");
    }
    if (!data.caption.trim() && !data.mediaUrl) {
      throw new Error("Add a caption or a media link");
    }

    const row = {
      organization_id: data.organizationId,
      social_account_id: data.socialAccountId,
      platform: data.platform,
      caption: data.caption,
      media_url: data.mediaUrl,
      media_type: data.mediaType,
      scheduled_at: data.scheduledAt,
      status: data.status,
      error: null,
    };

    if (data.id) {
      const { error } = await context.supabase
        .from("posts")
        .update(row)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const { data: created, error } = await context.supabase
      .from("posts")
      .insert({ ...row, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (created as { id: string }).id };
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
    const { data: member } = await context.supabase.rpc("is_org_member", {
      _org_id: data.organizationId,
      _user_id: context.userId,
    });
    if (!member) throw new Error("not_allowed");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { publishDuePosts } = await import("./publishing.server");
    return publishDuePosts(supabaseAdmin, data.organizationId);
  });
