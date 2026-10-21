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

/** Keeps Markdown line breaks but strips control chars and obvious prompt-injection phrases. */
function cleanArticleInput(value: string, limit: number): string {
  return value
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ")
    .replace(/\b(ignore|disregard|forget)\s+(all\s+|the\s+|your\s+|previous\s+|above\s+)*(instructions?|prompts?|rules?)\b/gi, " ")
    .replace(/^\s*(system|assistant|developer)\s*:/gim, " ")
    .slice(0, limit);
}

const WRITING_RULES = `Writing standard (always follow):
- Minimum 1,100 words of real, useful content (count only body text). Never pad.
- E-E-A-T: write from hands-on experience ("In our tests…", "When we set this up for creators…"), give practical steps, honest limitations, and who it is NOT for. No invented statistics — use only widely known facts or clearly label estimates.
- Match search intent: answer the exact question in the first 2-3 sentences (40-70 words, includes the focus keyword), then go deeper.
- Structure: H2/H3 headings (at least one containing the focus keyword), short paragraphs (max 3 sentences), bullet lists, numbered steps, and at least ONE Markdown table (comparison, checklist or pricing-style).
- Include a definition sentence ("X is a …"), concrete numbers (minutes, %, ₹, steps), a "Key takeaways" bullet list and a short conclusion with a call to action for AutoDM by Techaasvik.
- Focus keyword density 0.8-2% — natural, never stuffed.
- Links: at least 2 internal Markdown links using ONLY the internal pages listed, and at least 2 external links to trusted official sources (Meta / Instagram / Facebook / Google docs). Never invent internal URLs.
- Do NOT include an FAQ section inside the article body (FAQs are stored separately).`;

/** AI writing help for super admins (not counted against the user daily limit). */
export const adminBlogAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        task: z.enum(["outline", "improve", "meta", "faq", "agent"]),
        title: z.string().max(200),
        focusKeyword: z.string().max(120),
        content: z.string().max(40_000),
        slug: z.string().max(120).optional(),
        seoTitle: z.string().max(200).optional(),
        metaDescription: z.string().max(400).optional(),
        excerpt: z.string().max(800).optional(),
        failing: z.array(z.string().max(200)).max(40).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { readAiProviders, generateWithFailover } = await import("@/lib/ai-providers.server");
    const config = await readAiProviders(supabaseAdmin);

    const { data: others } = await supabaseAdmin
      .from("blog_posts")
      .select("slug, title")
      .eq("status", "published")
      .neq("slug", data.slug ?? "")
      .order("published_at", { ascending: false })
      .limit(12);
    const internalPages = [
      "/ — AutoDM home (Instagram & Facebook DM automation)",
      "/auth — Start free / sign up",
      "/blog — All guides",
      "/contact — Contact the team",
      ...(others ?? []).map((p) => `/blog/${p.slug} — ${p.title}`),
    ].join("\n");
    const sources =
      "https://developers.facebook.com/docs/messenger-platform, https://developers.facebook.com/docs/instagram-platform, https://help.instagram.com, https://www.facebook.com/business/help, https://transparency.meta.com/policies/community-standards, https://developers.google.com/search/docs/fundamentals/creating-helpful-content";

    const tasks: Record<string, string> = {
      outline: `Write a complete SEO, GEO and E-E-A-T optimised blog article in Markdown. Mention AutoDM by Techaasvik naturally. Return only the Markdown.\n${WRITING_RULES}`,
      improve: `Rewrite and expand this Markdown article for SEO and AI search (GEO) while keeping its facts. Return only the improved Markdown.\n${WRITING_RULES}`,
      meta: 'Return ONLY JSON: {"seoTitle": "40-58 chars, starts with the focus keyword", "metaDescription": "130-155 chars with the focus keyword", "excerpt": "1-2 sentence summary, 100-200 chars"}',
      faq: 'Return ONLY JSON: {"faq": [{"q": "question", "a": "2-3 sentence answer"}]} with 5 questions people really search about the topic.',
      agent: `You are an SEO & GEO optimisation agent. Improve EVERY part of this blog post so it passes all SEO and GEO checks (score 100/100) and fully satisfies user intent.
${WRITING_RULES}
Rules for the fields:
- SEO_TITLE: 40-58 characters, begins with the exact focus keyword.
- META: 130-155 characters, contains the exact focus keyword and a benefit.
- EXCERPT: 100-200 characters summary.
- COVER_ALT: descriptive alt text (8-14 words) with the focus keyword.
- FAQ: 5 real search questions, 2-3 sentence answers, as a JSON array [{"q":"…","a":"…"}].
- CONTENT: the full improved Markdown article. The very first paragraph (not a heading) must contain the exact focus keyword.
Return EXACTLY this format, nothing before or after:
===SEO_TITLE===
…
===META===
…
===EXCERPT===
…
===COVER_ALT===
…
===FAQ===
[…]
===CONTENT===
…`,
    };

    const failing = data.failing?.length ? `\nCurrently failing checks to fix:\n- ${data.failing.join("\n- ")}\n` : "";
    const prompt = cleanArticleInput(
      `Title: ${data.title}\nFocus keyword: ${data.focusKeyword}\nURL slug: ${data.slug ?? ""}\nCurrent SEO title: ${data.seoTitle ?? ""}\nCurrent meta description: ${data.metaDescription ?? ""}\nCurrent excerpt: ${data.excerpt ?? ""}\n${failing}\nInternal pages you may link to (use these exact paths):\n${internalPages}\n\nTrusted external sources you may cite: ${sources}\n\nCurrent content:\n${data.content || "(empty — write it from scratch)"}`,
      30_000,
    );
    const isLong = data.task === "outline" || data.task === "improve" || data.task === "agent";
    const result = await generateWithFailover({
      config: { ...config, enabled: true, useLovableFallback: true, maxCallsPerHour: 60 },
      system: `You are a senior SEO content writer and subject-matter expert for a social media DM automation SaaS (Instagram, Facebook, YouTube). ${tasks[data.task]}`,
      prompt,
      scope: `blog:${context.userId}`,
      long: true,
      inputLimit: 32_000,
      maxTokens: isLong ? 7000 : 1200,
    });
    if (!result.text) {
      const last = result.attempts.at(-1);
      const timedOut = result.attempts.some((a) => /abort/i.test(a.error));
      if (last?.provider === "budget") throw new Error("Hourly AI limit reached — try again later");
      if (timedOut) throw new Error("AI took too long to write this — try again or pick a faster model in Settings");
      if (last?.status === 429) throw new Error("AI is busy right now — try again in a moment");
      throw new Error(`AI could not complete this request (${result.attempts.map((a) => `${a.provider}: ${a.error}`).join("; ") || "no provider"})`);
    }
    const text = result.text.replace(/^```(?:markdown|md|json)?\s*|\s*```$/gi, "").trim();
    if (data.task !== "agent") return { text, agent: null };

    const part = (name: string) => {
      const m = text.match(new RegExp(`===${name}===\\s*([\\s\\S]*?)(?=\\n===[A-Z_]+===|$)`));
      return m?.[1]?.trim() ?? "";
    };
    let faq: FaqItem[] = [];
    try {
      const raw = part("FAQ").replace(/^```(?:json)?|```$/g, "").trim();
      faq = (JSON.parse(raw.match(/\[[\s\S]*\]/)?.[0] ?? "[]") as FaqItem[])
        .filter((f) => f && typeof f.q === "string" && typeof f.a === "string")
        .slice(0, 8);
    } catch {
      faq = [];
    }
    const content = part("CONTENT").replace(/^```(?:markdown|md)?\s*|\s*```$/g, "").trim();
    if (content.length < 200) throw new Error("The AI reply was incomplete — please try again");
    return {
      text: content,
      agent: {
        seoTitle: part("SEO_TITLE").replace(/^["']|["']$/g, "").slice(0, 120),
        metaDescription: part("META").replace(/^["']|["']$/g, "").slice(0, 320),
        excerpt: part("EXCERPT").slice(0, 600),
        coverAlt: part("COVER_ALT").slice(0, 200),
        faq,
      },
    };
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
