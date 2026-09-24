import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type WebhookEventRow = {
  id: string;
  provider: string;
  platform: "instagram" | "facebook" | "youtube" | null;
  event_type: string;
  status: "received" | "processed" | "failed" | "ignored";
  error: string | null;
  signature_valid: boolean;
  received_at: string;
};

export const listWebhookEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ organizationId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("webhook_events")
      .select("id, provider, platform, event_type, status, error, signature_valid, received_at")
      .eq("organization_id", data.organizationId)
      .order("received_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return (rows ?? []) as WebhookEventRow[];
  });

export const getWebhookConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({
    verifyTokenSet: Boolean(process.env["META_WEBHOOK_VERIFY_TOKEN"]),
    appSecretSet: Boolean(process.env["META_APP_SECRET"]),
  }));

export type DeliveryHealth = {
  inbound: { total: number; ok: number; byType: { type: string; total: number; failed: number }[] };
  outbound: { step: string; sent: number; failed: number; topError: string | null }[];
  gates: { id: string; status: string; attempts: number; created_at: string; last_checked_at: string | null }[];
  funnel: {
    comments: number;
    openers: number;
    taps: number;
    followerDirect: number;
    followPrompts: number;
    confirmedAfterFollow: number;
    finalDms: number;
  };
  tapsMissing: boolean;
};

export const getDeliveryHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        platform: z.enum(["all", "instagram", "facebook"]),
        hours: z.number().int().min(1).max(24 * 30),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<DeliveryHealth> => {
    const since = new Date(Date.now() - data.hours * 3_600_000).toISOString();
    let ev = context.supabase
      .from("webhook_events")
      .select("event_type, status, platform")
      .eq("organization_id", data.organizationId)
      .gte("received_at", since)
      .limit(5000);
    if (data.platform !== "all") ev = ev.eq("platform", data.platform);
    let gq = context.supabase
      .from("automation_follow_gates")
      .select("id, status, attempts, created_at, last_checked_at, platform")
      .eq("organization_id", data.organizationId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data.platform !== "all") gq = gq.eq("platform", data.platform);
    const [events, runs, gates] = await Promise.all([
      ev,
      context.supabase
        .from("automation_runs")
        .select("status, detail")
        .eq("organization_id", data.organizationId)
        .gte("created_at", since)
        .limit(5000),
      gq,
    ]);
    if (events.error) throw new Error(events.error.message);
    if (runs.error) throw new Error(runs.error.message);

    const byType = new Map<string, { total: number; failed: number }>();
    let ok = 0;
    for (const e of events.data ?? []) {
      const t = e.event_type.split(".").pop() ?? e.event_type;
      const cur = byType.get(t) ?? { total: 0, failed: 0 };
      cur.total++;
      if (e.status === "failed") cur.failed++;
      else ok++;
      byType.set(t, cur);
    }

    const STEPS = ["comment_reply", "tap_prompt", "follow_prompt", "reply_dm", "attachment"];
    const out = new Map<string, { sent: number; failed: number; errors: Map<string, number> }>();
    STEPS.forEach((s) => out.set(s, { sent: 0, failed: 0, errors: new Map() }));
    const count = (d: string) =>
      (runs.data ?? []).filter((r) => r.detail === d).length;
    for (const r of runs.data ?? []) {
      const detail = r.detail ?? "";
      const step = STEPS.find((s) => detail === s || detail.startsWith(`${s}:`));
      if (r.status === "sent" && step) out.get(step)!.sent++;
      if (r.status === "failed") {
        const s = out.get(step ?? "reply_dm")!;
        s.failed++;
        const msg = detail.replace(/^[a-z_]+:/, "").slice(0, 90);
        s.errors.set(msg, (s.errors.get(msg) ?? 0) + 1);
      }
    }
    const sentOf = (d: string) =>
      (runs.data ?? []).filter((r) => r.status === "sent" && r.detail === d).length;
    const openers = sentOf("tap_prompt");
    const taps = count("gate_tap_received");
    const gateRows = gates.data ?? [];
    const completedAfterPrompt = gateRows.filter((g) => g.status === "completed" && g.attempts > 1).length;
    const completedDirect = gateRows.filter((g) => g.status === "completed" && g.attempts <= 1).length;

    return {
      inbound: {
        total: (events.data ?? []).length,
        ok,
        byType: [...byType.entries()].map(([type, v]) => ({ type, ...v })),
      },
      outbound: STEPS.map((step) => {
        const s = out.get(step)!;
        const top = [...s.errors.entries()].sort((a, b) => b[1] - a[1])[0];
        return { step, sent: s.sent, failed: s.failed, topError: top?.[0] ?? null };
      }),
      gates: gateRows.map(({ platform: _p, ...g }) => g),
      funnel: {
        comments: sentOf("comment_reply") + count("no_matching_rule"),
        openers,
        taps,
        followerDirect: completedDirect,
        followPrompts: sentOf("follow_prompt"),
        confirmedAfterFollow: completedAfterPrompt,
        finalDms: sentOf("reply_dm"),
      },
      tapsMissing: openers >= 2 && taps === 0,
    };
  });
