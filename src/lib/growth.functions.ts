import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runModel } from "./ai.functions";
import {
  benchmarkTips,
  bestTimes,
  detectAnomalies,
  engagementGrid,
  engagementRate,
  funnelHeatmap,
  type FunnelStage,
} from "./growth";

const orgInput = z.object({ organizationId: z.string().uuid() });
const DAY = 86_400_000;

/** All growth insights for one workspace (read-only, RLS as the user). */
export const getGrowthOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const org = data.organizationId;
    const now = Date.now();
    const since = (ms: number) => new Date(now - ms).toISOString();
    const [convs, runs, rev, posts, competitors, accounts] = await Promise.all([
      sb.from("conversations").select("id").eq("organization_id", org).limit(5000),
      sb.from("automation_runs").select("status, created_at").eq("organization_id", org).gte("created_at", since(30 * DAY)).limit(10000),
      sb.from("revenue_events").select("kind, created_at").eq("organization_id", org).gte("created_at", since(30 * DAY)).limit(10000),
      sb.from("posts").select("published_at, status").eq("organization_id", org).eq("status", "published").gte("published_at", since(28 * DAY)).limit(2000),
      sb.from("growth_competitors").select("*").eq("organization_id", org).order("created_at"),
      sb.from("social_accounts").select("id").eq("organization_id", org),
    ]);
    const convIds = (convs.data ?? []).map((c) => c.id);
    let inbound: string[] = [];
    if (convIds.length) {
      const { data: msgs } = await sb
        .from("messages")
        .select("created_at")
        .in("conversation_id", convIds.slice(0, 500))
        .eq("direction", "inbound")
        .gte("created_at", since(60 * DAY))
        .limit(10000);
      inbound = (msgs ?? []).map((m) => m.created_at as string);
    }

    const grid = engagementGrid(inbound);
    const best = bestTimes(grid);

    const runRows = (runs.data ?? []) as { status: string; created_at: string }[];
    const revRows = (rev.data ?? []) as { kind: string; created_at: string }[];
    const stageOf: Record<string, FunnelStage> = { page_view: "page_open", page_click: "click", paid: "sale" };
    const events: { stage: FunnelStage; at: string }[] = [
      ...runRows.map((r) => ({ stage: "triggered" as const, at: r.created_at })),
      ...runRows.filter((r) => r.status === "sent").map((r) => ({ stage: "dm_sent" as const, at: r.created_at })),
      ...revRows.filter((r) => stageOf[r.kind]).map((r) => ({ stage: stageOf[r.kind]!, at: r.created_at })),
    ];
    const funnel = funnelHeatmap(events);

    const win = (rows: { created_at: string }[], pred: (r: any) => boolean) => {
      let last = 0, prev = 0;
      for (const r of rows) {
        if (!pred(r)) continue;
        const age = now - Date.parse(r.created_at);
        if (age <= DAY) last++;
        else if (age <= 8 * DAY) prev++;
      }
      return { last24h: last, prev7d: prev };
    };
    const inboundRows = inbound.map((created_at) => ({ created_at }));
    const anomalies = detectAnomalies([
      { key: "inbound", label: "Comments & DMs received", kind: "drop", ...win(inboundRows, () => true) },
      { key: "sent", label: "Automated DMs sent", kind: "drop", ...win(runRows, (r) => r.status === "sent") },
      { key: "failed", label: "Failed sends", kind: "spike", ...win(runRows, (r) => r.status === "failed") },
      { key: "inbound_spike", label: "Comments & DMs received", kind: "spike", ...win(inboundRows, () => true) },
    ]);

    const postsPerWeek = Math.round(((posts.data ?? []).length / 4) * 10) / 10;
    const totalPosts = Math.max(1, (posts.data ?? []).length);
    const last28Inbound = inbound.filter((t) => now - Date.parse(t) <= 28 * DAY).length;
    const avgComments = Math.round((last28Inbound / totalPosts) * 10) / 10;
    const comp = (competitors.data ?? []).map((c: any) => ({
      id: c.id as string,
      name: c.name as string,
      handle: c.handle as string | null,
      platform: c.platform as string,
      followers: c.followers as number,
      postsPerWeek: Number(c.posts_per_week),
      avgComments: Number(c.avg_comments),
      engagementRate: engagementRate(c.followers, Number(c.avg_comments)),
    }));

    return {
      grid,
      best,
      sampleSize: inbound.length,
      funnel,
      anomalies,
      you: { postsPerWeek, avgComments, accounts: (accounts.data ?? []).length },
      competitors: comp,
    };
  });

const competitorInput = z.object({
  organizationId: z.string().uuid(),
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  handle: z.string().trim().max(80).optional(),
  platform: z.enum(["instagram", "facebook", "youtube"]),
  followers: z.number().int().min(0).max(1_000_000_000),
  postsPerWeek: z.number().min(0).max(200),
  avgComments: z.number().min(0).max(1_000_000),
});

export const saveCompetitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => competitorInput.parse(d))
  .handler(async ({ data, context }) => {
    const row = {
      organization_id: data.organizationId,
      name: data.name,
      handle: data.handle?.replace(/^@/, "") || null,
      platform: data.platform,
      followers: data.followers,
      posts_per_week: data.postsPerWeek,
      avg_comments: data.avgComments,
      updated_at: new Date().toISOString(),
    };
    const res = data.id
      ? await context.supabase.from("growth_competitors").update(row).eq("id", data.id).eq("organization_id", data.organizationId)
      : await context.supabase.from("growth_competitors").insert(row);
    if (res.error) throw new Error("Only owners, admins and managers can change competitors.");
    return { ok: true };
  });

export const deleteCompetitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgInput.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("growth_competitors").delete().eq("id", data.id).eq("organization_id", data.organizationId);
    if (error) throw new Error("Only owners, admins and managers can remove competitors.");
    return { ok: true };
  });

const ideasSchema = z.object({
  ideas: z.array(z.object({ title: z.string(), hook: z.string(), format: z.string(), keyword: z.string() })).min(1).max(8),
});
export type ContentIdea = z.infer<typeof ideasSchema>["ideas"][number];

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[|::)/i;

async function readPublicPage(raw: string): Promise<string> {
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!/^https?:$/.test(url.protocol) || PRIVATE_HOST.test(url.hostname) || !url.hostname.includes(".")) return "";
    const res = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { "user-agent": "Mozilla/5.0 AutoDM-Growth" }, redirect: "follow" });
    if (!res.ok) return "";
    const html = (await res.text()).slice(0, 200_000);
    const pick = (re: RegExp) => (html.match(re)?.[1] ?? "").replace(/\s+/g, " ").trim();
    const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const desc = pick(/<meta[^>]+(?:name|property)=["'](?:og:)?description["'][^>]+content=["']([^"']*)/i);
    const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 1200);
    return [title && `Title: ${title}`, desc && `Description: ${desc}`, body && `Text: ${body}`].filter(Boolean).join("\n");
  } catch {
    return "";
  }
}

/** Connected account handles to pre-fill the auto-fill form (no AI, no cost). */
export const getProfileSources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: accs } = await context.supabase.from("social_accounts").select("platform, handle, name").eq("organization_id", data.organizationId);
    const out: Record<string, string> = {};
    for (const a of accs ?? []) if (!out[a.platform]) out[a.platform] = (a.handle || a.name || "") as string;
    return out;
  });

/** Guess niche + goal from a website and social handles. Uses 1 AI request. */
export const autofillProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    orgInput.extend({
      website: z.string().trim().max(200).optional(),
      instagram: z.string().trim().max(80).optional(),
      facebook: z.string().trim().max(120).optional(),
      youtube: z.string().trim().max(120).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!data.website && !data.instagram && !data.facebook && !data.youtube) throw new Error("Add a website or at least one handle.");
    const clean = (h?: string) => h?.replace(/^@/, "").replace(/^https?:\/\/[^/]+\//, "").replace(/\/$/, "");
    const [site, yt] = await Promise.all([
      data.website ? readPublicPage(data.website) : Promise.resolve(""),
      data.youtube ? readPublicPage(`https://www.youtube.com/@${clean(data.youtube)}`) : Promise.resolve(""),
    ]);
    const { data: posts } = await context.supabase.from("posts").select("caption").eq("organization_id", data.organizationId).order("created_at", { ascending: false }).limit(5);
    const captions = (posts ?? []).map((p) => (p.caption ?? "").slice(0, 120)).filter(Boolean).join(" | ");
    const prompt = [
      data.website && `Website: ${data.website}\n${site || "(could not read the page)"}`,
      data.instagram && `Instagram handle: @${clean(data.instagram)}`,
      data.facebook && `Facebook page: ${clean(data.facebook)}`,
      data.youtube && `YouTube channel: @${clean(data.youtube)}\n${yt.slice(0, 600)}`,
      captions && `Recent captions: ${captions}`,
    ].filter(Boolean).join("\n\n");
    return runModel(
      prompt,
      "From the business information, infer the creator's niche (max 8 words, specific, e.g. 'eggless home baking classes in Pune') and the most likely social media goal (max 8 words, e.g. 'sell online baking course'). Use handle names as hints if the page is empty.",
      z.object({ niche: z.string().min(2).transform((s) => s.slice(0, 200)), goal: z.string().transform((s) => s.slice(0, 120)) }),
      context.userId,
      '{"niche":"","goal":""}',
    );
  });

const planDay = z.object({
  day: z.coerce.number(),
  theme: z.string(),
  title: z.string(),
  format: z.string(),
  platform: z.string().default("Instagram"),
  postTime: z.string().default(""),
  hook: z.string(),
  script: z.string(),
  caption: z.string(),
  hashtags: z.array(z.string()).default([]),
  cta: z.string().default(""),
  keyword: z.string().default(""),
  dmReply: z.string().default(""),
});
const planSchema = z.object({ days: z.array(planDay).min(7).max(7) });
export type PlanDay = z.infer<typeof planDay>;

/** Complete, ready-to-post 7-day content plan. Uses 1 AI request. */
export const generateContentPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    orgInput.extend({
      niche: z.string().trim().min(2).max(200),
      goal: z.string().trim().max(120).optional(),
      topic: z.string().trim().max(200).optional(),
      bestTimes: z.array(z.string().max(30)).max(5).optional(),
      language: z.enum(["English", "Hinglish", "Hindi"]).default("English"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: posts } = await context.supabase.from("posts").select("caption").eq("organization_id", data.organizationId).order("created_at", { ascending: false }).limit(8);
    const recent = (posts ?? []).map((p) => (p.caption ?? "").slice(0, 160)).filter(Boolean).join("\n- ");
    const prompt = [
      `Niche: ${data.niche}`,
      `Goal: ${data.goal || "more comments and DMs"}`,
      data.topic && `Focus topic for this week: ${data.topic}`,
      `Language: ${data.language}`,
      data.bestTimes?.length ? `Audience is most active at: ${data.bestTimes.join(", ")} (India time)` : "Suggest good India-time posting slots.",
      `Recent captions (avoid repeating):\n- ${recent || "(none yet)"}`,
    ].filter(Boolean).join("\n");
    const out = await runModel(
      prompt,
      [
        "You are a social media growth strategist for Instagram, Facebook and YouTube creators in India.",
        "Build a complete 7-day content plan (day 1..7), ready to post as-is. Mix formats (Reel, Carousel, Story, Post, YouTube Short) and themes (educate, story, proof, behind-the-scenes, engagement, offer, FAQ).",
        "For each day give: theme, title, format, platform, postTime (e.g. '7:30 PM'), hook (first line), script (Reel/Short shot-by-shot or carousel slide-by-slide, 4-7 short lines separated by \\n), caption (60-150 words, ends with the CTA), hashtags (6-10, with #), cta, keyword (one UPPERCASE word people comment to get a DM), dmReply (the DM text sent when someone comments the keyword, under 50 words).",
        "Never suggest misleading claims, giveaways that require tagging, or banned content.",
      ].join("\n"),
      planSchema,
      context.userId,
      '{"days":[{"day":1,"theme":"","title":"","format":"Reel","platform":"Instagram","postTime":"7:30 PM","hook":"","script":"","caption":"","hashtags":["#tag"],"cta":"","keyword":"LINK","dmReply":""}]}',
    );
    return out.days.sort((a, b) => a.day - b.day);
  });

/** AI content ideas from the niche + recent captions; counts toward the daily AI limit. */
export const generateContentIdeas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgInput.extend({ niche: z.string().trim().min(2).max(200), goal: z.string().trim().max(120).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: posts } = await context.supabase
      .from("posts")
      .select("caption")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false })
      .limit(8);
    const recent = (posts ?? []).map((p) => (p.caption ?? "").slice(0, 160)).filter(Boolean).join("\n- ");
    const prompt = `Niche: ${data.niche}\nGoal: ${data.goal || "more comments and DMs"}\nRecent captions:\n- ${recent || "(none yet)"}`;
    const out = await runModel(
      prompt,
      "You are a social media growth strategist for Instagram and Facebook creators in India. Suggest 6 fresh post ideas. Each idea gets a short title, a scroll-stopping first-line hook, a format (Reel, Carousel, Story or Post) and one single-word comment keyword (uppercase) that people can comment to receive a DM. Never suggest misleading claims, giveaways that require tagging, or banned content.",
      ideasSchema,
      context.userId,
      '{"ideas":[{"title":"","hook":"","format":"Reel","keyword":"LINK"}]}',
    );
    return out.ideas;
  });
