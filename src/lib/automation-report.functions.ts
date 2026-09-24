import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { explainReason } from "@/lib/activity-explain";

export type ReportRow = {
  id: string;
  handle: string;
  platform: string;
  rule: string;
  startedAt: string;
  publicReply: boolean;
  finalDm: boolean;
  sentAt: string | null;
  outcome: "delivered" | "failed" | "skipped" | "in_progress";
  failedStage: string | null;
  failedReason: string | null;
  linkClicked: boolean;
  attachmentClicked: boolean;
};

export type AutomationReport = {
  totals: {
    attempts: number;
    publicReplies: number;
    dmsSent: number;
    failed: number;
    skipped: number;
    linkClicks: number;
    attachmentClicks: number;
  };
  failedByStage: { stage: string; count: number }[];
  series: { date: string; attempts: number; dms: number; failed: number }[];
  rows: ReportRow[];
};

const PUBLIC = ["comment_reply", "comment_public_reply"];
const FINAL = ["reply_dm", "comment_private_reply"];
const GAP = 24 * 60 * 60 * 1000;

function stageOf(detail: string, sent: Set<string>, channel: string) {
  const d = detail.toLowerCase();
  if (d.startsWith("attachment")) return "Attachment";
  if (d.includes("follow")) return "Follow check";
  if (sent.has("follow_prompt") || sent.has("tap_prompt")) return "Final DM";
  if (channel === "comment" && !sent.has("comment_reply")) return "Public reply";
  if (channel === "comment") return "Opener DM";
  return "Final DM";
}

export const getAutomationReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        from: z.string(),
        to: z.string(),
        platform: z.enum(["all", "instagram", "facebook", "youtube"]).default("all"),
        bucket: z.enum(["day", "week", "month"]).default("day"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<AutomationReport> => {
    const sb = context.supabase;
    const [runsRes, convRes, rulesRes] = await Promise.all([
      sb
        .from("automation_runs")
        .select("id, rule_id, conversation_id, status, detail, created_at")
        .eq("organization_id", data.organizationId)
        .gte("created_at", data.from)
        .lte("created_at", data.to)
        .order("created_at", { ascending: true })
        .limit(20000),
      sb
        .from("conversations")
        .select("id, platform, channel, external_user_name, external_user_id")
        .eq("organization_id", data.organizationId),
      sb.from("automation_rules").select("id, name").eq("organization_id", data.organizationId),
    ]);
    for (const r of [runsRes, convRes, rulesRes]) if (r.error) throw new Error(r.error.message);

    const convs = new Map((convRes.data ?? []).map((c) => [c.id, c]));
    const rules = new Map((rulesRes.data ?? []).map((r) => [r.id, r.name]));

    type Attempt = ReportRow & { last: number; sent: Set<string>; channel: string };
    const open = new Map<string, Attempt>();
    const attempts: Attempt[] = [];
    let linkClicks = 0;
    let attachmentClicks = 0;
    let publicReplies = 0;
    let dmsSent = 0;
    let failed = 0;
    let skipped = 0;
    const stageCounts = new Map<string, number>();

    for (const run of runsRes.data ?? []) {
      const conv = run.conversation_id ? convs.get(run.conversation_id) : undefined;
      if (!conv) continue; // global safety skips without a contact
      if (data.platform !== "all" && conv.platform !== data.platform) continue;
      const detail = run.detail ?? "";
      const t = new Date(run.created_at).getTime();
      const isClick = detail.startsWith("click:");
      const key = isClick ? [...open.keys()].find((k) => k.startsWith(`${conv.id}|`)) : `${conv.id}|${run.rule_id}`;

      if (isClick) {
        if (detail === "click:link") linkClicks++;
        else attachmentClicks++;
        const a = key ? open.get(key) : undefined;
        if (a) {
          if (detail === "click:link") a.linkClicked = true;
          else a.attachmentClicked = true;
        }
        continue;
      }
      if (detail.startsWith("post_reply:") || detail.startsWith("trace:")) continue;

      let a = open.get(key!);
      if (!a || t - a.last > GAP) {
        a = {
          id: run.id,
          handle: conv.external_user_name || conv.external_user_id,
          platform: conv.platform,
          rule: run.rule_id ? (rules.get(run.rule_id) ?? "Deleted rule") : "Safety settings",
          startedAt: run.created_at,
          publicReply: false,
          finalDm: false,
          sentAt: null,
          outcome: "in_progress",
          failedStage: null,
          failedReason: null,
          linkClicked: false,
          attachmentClicked: false,
          last: t,
          sent: new Set(),
          channel: conv.channel,
        };
        open.set(key!, a);
        attempts.push(a);
      }
      a.last = t;

      if (run.status === "sent") {
        a.sent.add(detail);
        if (PUBLIC.includes(detail)) {
          a.publicReply = true;
          publicReplies++;
        }
        if (FINAL.includes(detail)) {
          a.finalDm = true;
          a.sentAt = run.created_at;
          a.outcome = "delivered";
          dmsSent++;
        }
      } else if (run.status === "failed") {
        failed++;
        const stage = stageOf(detail, a.sent, a.channel);
        stageCounts.set(stage, (stageCounts.get(stage) ?? 0) + 1);
        if (!a.finalDm) a.outcome = "failed";
        a.failedStage = stage;
        a.failedReason = explainReason(detail).title;
      } else if (run.status === "skipped") {
        skipped++;
        if (a.outcome === "in_progress" && a.sent.size === 0) {
          a.outcome = "skipped";
          a.failedStage = "Skipped";
          a.failedReason = explainReason(detail).title;
        }
      }
    }

    const bucketKey = (iso: string) => {
      const d = new Date(iso);
      if (data.bucket === "month") return iso.slice(0, 7);
      if (data.bucket === "week") {
        const day = (d.getUTCDay() + 6) % 7;
        d.setUTCDate(d.getUTCDate() - day);
        return d.toISOString().slice(0, 10);
      }
      return iso.slice(0, 10);
    };
    const series = new Map<string, { date: string; attempts: number; dms: number; failed: number }>();
    for (const a of attempts) {
      const k = bucketKey(a.startedAt);
      const s = series.get(k) ?? { date: k, attempts: 0, dms: 0, failed: 0 };
      s.attempts++;
      if (a.finalDm) s.dms++;
      if (a.outcome === "failed") s.failed++;
      series.set(k, s);
    }

    return {
      totals: {
        attempts: attempts.length,
        publicReplies,
        dmsSent,
        failed,
        skipped,
        linkClicks,
        attachmentClicks,
      },
      failedByStage: [...stageCounts.entries()]
        .map(([stage, count]) => ({ stage, count }))
        .sort((x, y) => y.count - x.count),
      series: [...series.values()].sort((x, y) => x.date.localeCompare(y.date)),
      rows: attempts
        .reverse()
        .map(({ last: _l, sent: _s, channel: _c, ...row }) => row),
    };
  });
