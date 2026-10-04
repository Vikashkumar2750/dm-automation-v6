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
