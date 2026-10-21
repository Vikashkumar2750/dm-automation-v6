import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FaqItem = { q: string; a: string };
export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  seo_title: string | null;
  meta_description: string | null;
  excerpt: string;
  content: string;
  focus_keyword: string | null;
  cover_url: string | null;
  cover_alt: string | null;
  author_name: string;
  status: string;
  tags: string[];
  faq: FaqItem[];
  noindex: boolean;
  canonical_url: string | null;
  published_at: string | null;
  updated_at: string;
};

type Ctx = { supabase: { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> } };
async function assertSuperAdmin(context: unknown) {
  const { data, error } = await (context as Ctx).supabase.rpc("current_user_has_platform_role", { _role: "super_admin" });
  if (error || !data) throw new Error("forbidden");
}

const PUBLIC_COLS =
  "id, slug, title, seo_title, meta_description, excerpt, content, focus_keyword, cover_url, cover_alt, author_name, status, tags, faq, noindex, canonical_url, published_at, updated_at";

export const listPublishedPosts = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("blog_posts")
    .select("slug, title, excerpt, cover_url, cover_alt, published_at, tags, author_name")
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(100);
  return data ?? [];
});

export const getPublishedPost = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: post } = await supabaseAdmin
      .from("blog_posts")
      .select(PUBLIC_COLS)
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    return (post as unknown as BlogPost) ?? null;
  });

export const adminListPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("blog_posts").select(PUBLIC_COLS).order("updated_at", { ascending: false });
    return (data ?? []) as unknown as BlogPost[];
  });

const postSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().min(1).max(90).regex(/^[a-z0-9-]+$/),
  title: z.string().trim().min(3).max(200),
  seo_title: z.string().max(120).nullable(),
  meta_description: z.string().max(320).nullable(),
  excerpt: z.string().max(600),
  content: z.string().max(100_000),
  focus_keyword: z.string().max(120).nullable(),
  cover_url: z.string().url().max(800).nullable().or(z.literal("").transform(() => null)),
  cover_alt: z.string().max(200).nullable(),
  author_name: z.string().max(80),
  status: z.enum(["draft", "published"]),
  tags: z.array(z.string().max(40)).max(15),
  faq: z.array(z.object({ q: z.string().max(300), a: z.string().max(1500) })).max(20),
  noindex: z.boolean(),
  canonical_url: z.string().url().max(800).nullable().or(z.literal("").transform(() => null)),
});

export const adminSavePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => postSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...rest } = data;
    let publishedAt: string | null = null;
    if (id) {
      const { data: existing } = await supabaseAdmin.from("blog_posts").select("published_at").eq("id", id).maybeSingle();
      publishedAt = existing?.published_at ?? null;
    }
    if (rest.status === "published" && !publishedAt) publishedAt = new Date().toISOString();
    const row = { ...rest, faq: rest.faq as never, published_at: publishedAt };
    const q = id
      ? supabaseAdmin.from("blog_posts").update(row).eq("id", id).select("id").single()
      : supabaseAdmin.from("blog_posts").insert(row).select("id").single();
    const { data: saved, error } = await q;
    if (error) throw new Error(error.message.includes("duplicate") ? "That URL slug is already used" : error.message);
    return { id: saved.id };
  });

export const adminDeletePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("blog_posts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** AI writing help for super admins (not counted against the user daily limit). */
export const adminBlogAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        task: z.enum(["outline", "improve", "meta", "faq"]),
        title: z.string().max(200),
        focusKeyword: z.string().max(120),
        content: z.string().max(20_000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { readAiProviders, generateWithFailover, sanitisePromptInput } = await import("@/lib/ai-providers.server");
    const config = await readAiProviders(supabaseAdmin);
    const tasks: Record<string, string> = {
      outline:
        "Write a complete SEO and GEO optimised blog article in Markdown (900-1300 words). Start with a 2-3 sentence direct answer, use H2/H3 headings containing the focus keyword, bullet lists, concrete numbers, and mention AutoDM by Techaasvik naturally. Return only the Markdown.",
      improve:
        "Improve this Markdown article for SEO and AI search (GEO): clearer direct answer at the top, keyword in a subheading, short paragraphs, lists, a definition sentence. Keep facts; do not invent statistics. Return only the improved Markdown.",
      meta: 'Return ONLY JSON: {"seoTitle": "30-60 chars with keyword", "metaDescription": "120-160 chars with keyword", "excerpt": "1-2 sentence summary, 80-200 chars"}',
      faq: 'Return ONLY JSON: {"faq": [{"q": "question", "a": "2-3 sentence answer"}]} with 4 questions people really search about the topic.',
    };
    const result = await generateWithFailover({
      config: { ...config, enabled: true, useLovableFallback: true, maxCallsPerHour: 60 },
      system: `You are a senior SEO content writer for a social media DM automation SaaS (Instagram, Facebook, YouTube). ${tasks[data.task]}`,
      prompt: sanitisePromptInput(
        `Title: ${data.title}\nFocus keyword: ${data.focusKeyword}\n\nCurrent content:\n${data.content}`,
        18_000,
      ),
      scope: `blog:${context.userId}`,
      long: true,
    });
    if (!result.text) {
      const last = result.attempts.at(-1);
      const timedOut = result.attempts.some((a) => /abort/i.test(a.error));
      if (last?.provider === "budget") throw new Error("Hourly AI limit reached — try again later");
      if (timedOut) throw new Error("AI took too long to write this — try again or pick a faster model in Settings");
      if (last?.status === 402) throw new Error("AI credits are exhausted — add credits or another key in Settings");
      if (last?.status === 429) throw new Error("AI is busy right now — try again in a moment");
      throw new Error(`AI could not complete this request (${result.attempts.map((a) => `${a.provider}: ${a.error}`).join("; ") || "no provider"})`);
    }
    return { text: result.text.replace(/^```(?:markdown|md|json)?\s*|\s*```$/gi, "").trim() };
  });

const IMAGE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };

/** Upload a blog image (≤5 MB) to the public blog-media library and return its URL. */
export const adminUploadBlogImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ name: z.string().max(120), type: z.string(), base64: z.string().max(7_000_000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const ext = IMAGE_TYPES[data.type];
    if (!ext) throw new Error("Only PNG, JPG, WebP or GIF images are allowed");
    const bytes = Buffer.from(data.base64, "base64");
    if (bytes.byteLength > 5 * 1024 * 1024) throw new Error("Image must be under 5 MB");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bucket = "blog-media";
    const { data: existing } = await supabaseAdmin.storage.getBucket(bucket);
    if (!existing) {
      await supabaseAdmin.storage.createBucket(bucket, { public: true, fileSizeLimit: "5MB" });
    }
    const base = data.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60) || "image";
    const path = `${new Date().toISOString().slice(0, 7)}/${base}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const { error } = await supabaseAdmin.storage.from(bucket).upload(path, bytes, { contentType: data.type });
    if (error) throw new Error(error.message);
    return { url: supabaseAdmin.storage.from(bucket).getPublicUrl(path).data.publicUrl };
  });
