import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AnalyticsPoint = {
  date: string;
  inbound: number;
  outbound: number;
  automated: number;
};

export type PlatformBreakdown = {
  platform: "instagram" | "facebook" | "youtube";
  conversations: number;
  inbound: number;
  outbound: number;
};

export type AnalyticsSummary = {
  rangeDays: number;
  totals: {
    conversations: number;
    inbound: number;
    outbound: number;
    automated: number;
    manual: number;
    resolved: number;
    openThreads: number;
    unread: number;
    postsPublished: number;
    postsFailed: number;
    postsScheduled: number;
    automationBlocked: number;
    automationRuns: number;
    activeRules: number;
    activeFlows: number;
  };
  responseRate: number;
  automationShare: number;
  medianFirstResponseMinutes: number | null;
  series: AnalyticsPoint[];
  byPlatform: PlatformBreakdown[];
  byChannel: { channel: string; conversations: number }[];
  topRules: { name: string; runs: number }[];
};

const dayKey = (iso: string) => iso.slice(0, 10);

export const getAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        rangeDays: z.number().int().min(7).max(90).default(30),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<AnalyticsSummary> => {
    const supabase = context.supabase;
    const since = new Date(Date.now() - data.rangeDays * 24 * 60 * 60 * 1000);
    const sinceIso = since.toISOString();

    const [convRes, postRes, runRes, ruleRes] = await Promise.all([
      supabase
        .from("conversations")
        .select("id, platform, channel, status, unread_count, created_at")
        .eq("organization_id", data.organizationId),
      supabase
        .from("posts")
        .select("id, status, created_at")
        .eq("organization_id", data.organizationId),
      supabase
        .from("automation_runs")
        .select("id, rule_id, status, message_id, created_at, run_key")
        .eq("organization_id", data.organizationId)
        .gte("created_at", sinceIso),
      supabase
        .from("automation_rules")
        .select("id, name, is_active")
        .eq("organization_id", data.organizationId),
    ]);

    for (const res of [convRes, postRes, runRes, ruleRes]) {
      if (res.error) throw new Error(res.error.message);
    }

    const conversations = convRes.data ?? [];
    const convIds = conversations.map((c) => c.id);

    let messages: {
      conversation_id: string;
      direction: "inbound" | "outbound";
      sent_at: string;
      sent_by: string | null;
      id: string;
    }[] = [];

    if (convIds.length > 0) {
      const { data: rows, error } = await supabase
        .from("messages")
        .select("id, conversation_id, direction, sent_at, sent_by")
        .in("conversation_id", convIds)
        .gte("sent_at", sinceIso)
        .order("sent_at", { ascending: true })
        .limit(10000);
      if (error) throw new Error(error.message);
      messages = (rows ?? []) as typeof messages;
    }

    const runs = runRes.data ?? [];
    const automatedMessageIds = new Set(
      runs.filter((r) => r.status === "sent" && r.message_id).map((r) => r.message_id as string),
    );

    // Daily series
    const buckets = new Map<string, AnalyticsPoint>();
    for (let i = data.rangeDays - 1; i >= 0; i -= 1) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, { date: key, inbound: 0, outbound: 0, automated: 0 });
    }

    let inbound = 0;
    let outbound = 0;
    let automated = 0;

    const convById = new Map(conversations.map((c) => [c.id, c]));
    const platformTotals = new Map<string, PlatformBreakdown>();
    const channelTotals = new Map<string, number>();

    for (const c of conversations) {
      channelTotals.set(c.channel, (channelTotals.get(c.channel) ?? 0) + 1);
      const p = platformTotals.get(c.platform) ?? {
        platform: c.platform,
        conversations: 0,
        inbound: 0,
        outbound: 0,
      };
      p.conversations += 1;
      platformTotals.set(c.platform, p);
    }

    // First response times
    const firstInbound = new Map<string, number>();
    const firstResponse: number[] = [];

    for (const m of messages) {
      const key = dayKey(m.sent_at);
      const bucket = buckets.get(key);
      const conv = convById.get(m.conversation_id);
      const isAutomated = automatedMessageIds.has(m.id);
      if (m.direction === "inbound") {
        inbound += 1;
        if (bucket) bucket.inbound += 1;
        if (conv) {
          const p = platformTotals.get(conv.platform);
          if (p) p.inbound += 1;
        }
        if (!firstInbound.has(m.conversation_id)) {
          firstInbound.set(m.conversation_id, new Date(m.sent_at).getTime());
        }
      } else {
        outbound += 1;
        if (bucket) bucket.outbound += 1;
        if (isAutomated) {
          automated += 1;
          if (bucket) bucket.automated += 1;
        }
        if (conv) {
          const p = platformTotals.get(conv.platform);
          if (p) p.outbound += 1;
        }
        const started = firstInbound.get(m.conversation_id);
        if (started !== undefined) {
          firstResponse.push((new Date(m.sent_at).getTime() - started) / 60000);
          firstInbound.delete(m.conversation_id);
        }
      }
    }

    firstResponse.sort((a, b) => a - b);
    const medianFirstResponseMinutes =
      firstResponse.length > 0
        ? Math.round(firstResponse[Math.floor(firstResponse.length / 2)] ?? 0)
        : null;

    const answeredConversations = new Set(
      messages.filter((m) => m.direction === "outbound").map((m) => m.conversation_id),
    );
    const engagedConversations = new Set(
      messages.filter((m) => m.direction === "inbound").map((m) => m.conversation_id),
    );
    const responseRate =
      engagedConversations.size > 0
        ? Math.round(
            ([...engagedConversations].filter((id) => answeredConversations.has(id)).length /
              engagedConversations.size) *
              100,
          )
        : 0;

    const ruleNames = new Map((ruleRes.data ?? []).map((r) => [r.id, r.name]));
    const ruleCounts = new Map<string, number>();
    let automationBlocked = 0;
    for (const r of runs) {
      if (r.status === "sent" && r.rule_id) {
        ruleCounts.set(r.rule_id, (ruleCounts.get(r.rule_id) ?? 0) + 1);
      } else if (r.status === "skipped" || r.status === "failed") {
        automationBlocked += 1;
      }
    }

    // One run = one count, however many steps it sent.
    const runKeys = new Set(runs.filter((r) => r.status === "sent").map((r) => r.run_key || r.id));
    const activeRules = (ruleRes.data ?? []).filter((r) => r.is_active).length;
    let activeFlows = 0;
    // Membership already proven: the RLS-scoped rules/conversations reads above succeeded for this org.
    const { data: member } = await supabase.from("organizations").select("id").eq("id", data.organizationId).maybeSingle();
    if (member) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: ps } = await supabaseAdmin.from("platform_settings").select("feature_flags").eq("id", true).maybeSingle();
        const cfg = (ps?.feature_flags as Record<string, unknown> | null)?.[`flows_cfg_${data.organizationId}`];
        if (Array.isArray(cfg)) activeFlows = cfg.filter((f) => (f as { active?: boolean })?.active).length;
      } catch { /* flows count is optional */ }
    }

    const posts = postRes.data ?? [];

    return {
      rangeDays: data.rangeDays,
      totals: {
        conversations: conversations.length,
        inbound,
        outbound,
        automated,
        manual: Math.max(outbound - automated, 0),
        resolved: conversations.filter((c) => c.status === "resolved").length,
        openThreads: conversations.filter((c) => c.status === "open").length,
        unread: conversations.reduce((sum, c) => sum + (c.unread_count ?? 0), 0),
        postsPublished: posts.filter((p) => p.status === "published").length,
        postsFailed: posts.filter((p) => p.status === "failed").length,
        postsScheduled: posts.filter((p) => p.status === "scheduled").length,
        automationBlocked,
        automationRuns: runKeys.size,
        activeRules,
        activeFlows,
      },
      responseRate,
      automationShare: outbound > 0 ? Math.round((automated / outbound) * 100) : 0,
      medianFirstResponseMinutes,
      series: [...buckets.values()],
      byPlatform: [...platformTotals.values()].sort((a, b) => b.conversations - a.conversations),
      byChannel: [...channelTotals.entries()]
        .map(([channel, count]) => ({ channel, conversations: count }))
        .sort((a, b) => b.conversations - a.conversations),
      topRules: [...ruleCounts.entries()]
        .map(([id, count]) => ({ name: ruleNames.get(id) ?? "Deleted rule", runs: count }))
        .sort((a, b) => b.runs - a.runs)
        .slice(0, 5),
    };
  });
