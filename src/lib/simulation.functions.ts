import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SimScenario = "follower" | "non_follower" | "unknown" | "duplicate" | "expired";

export type SimStep = {
  label: string;
  follows: boolean | null;
  messages: { url: string; text: string; buttons: string[] }[];
  runs: { status: string; detail: string | null }[];
  gateStatus: string | null;
};

export type SimResult = {
  pass: boolean;
  summary: string;
  steps: SimStep[];
};

async function readSimulatorAccess(
  context: { supabase: any; userId: string },
  organizationId: string,
) {
  const [{ data: superAdmin }, { data: member }] = await Promise.all([
    context.supabase.rpc("current_user_has_platform_role", { _role: "super_admin" }),
    context.supabase.rpc("current_user_has_org_role", {
      _org_id: organizationId,
      _roles: ["owner", "admin", "manager"],
    }),
  ]);
  if (superAdmin) return { allowed: true, isSuperAdmin: true };
  if (!member) return { allowed: false, isSuperAdmin: false };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: settings } = await supabaseAdmin
    .from("platform_settings")
    .select("feature_flags")
    .eq("id", true)
    .maybeSingle();
  const flags = (settings?.feature_flags ?? {}) as Record<string, boolean>;
  const userKey = `simulator_user_${organizationId}_${context.userId}`;
  const orgKey = `simulator_org_${organizationId}`;
  return { allowed: Boolean(flags[userKey] ?? flags[orgKey] ?? false), isSuperAdmin: false };
}

export const getSimulatorAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => readSimulatorAccess(context, data.organizationId));

const PAYLOAD_RE = /AUTOMATION_FOLLOW_CHECK:[^"\s]+/g;

function describe(payload: Record<string, unknown>) {
  const json = JSON.stringify(payload);
  const msg = (payload["message"] ?? {}) as Record<string, unknown>;
  const text =
    (typeof msg["text"] === "string" && msg["text"]) ||
    (typeof payload["message"] === "string" && payload["message"]) ||
    (json.match(/"text":"([^"]+)"/)?.[1] ?? "") ||
    (json.match(/"url":"([^"]+)"/)?.[1] ? `[attachment/link]` : "");
  const buttons = [...json.matchAll(/"title":"([^"]+)"/g)].map((m) => m[1]!);
  return { text: String(text), buttons };
}

export function extractPayloads(calls: { payload: Record<string, unknown> }[]) {
  return calls.flatMap((c) => JSON.stringify(c.payload).match(PAYLOAD_RE) ?? []);
}

export const runAutomationSimulation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        socialAccountId: z.string().uuid(),
        ruleId: z.string().uuid(),
        scenario: z.enum(["follower", "non_follower", "unknown", "duplicate", "expired"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<SimResult> => {
    const access = await readSimulatorAccess(context, data.organizationId);
    if (!access.allowed) throw new Error("Test console is not enabled for this workspace");

    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { runAutomations, handleFollowGateReply, runSimulated } = await import(
      "@/lib/automation.server"
    );

    const [{ data: account }, { data: rule }] = await Promise.all([
      admin
        .from("social_accounts")
        .select("id, platform, external_id")
        .eq("id", data.socialAccountId)
        .eq("organization_id", data.organizationId)
        .maybeSingle(),
      admin
        .from("automation_rules")
        .select("id, keywords, target_post_ids, trigger")
        .eq("id", data.ruleId)
        .eq("organization_id", data.organizationId)
        .maybeSingle(),
    ]);
    if (!account || !rule) throw new Error("Account or rule not found");
    if (account.platform === "youtube") throw new Error("Only Instagram/Facebook supported");
    const platform = account.platform as "instagram" | "facebook";

    const simUser = `sim_${data.scenario}_${crypto.randomUUID().slice(0, 8)}`;
    const { data: conv, error: convErr } = await admin
      .from("conversations")
      .insert({
        organization_id: data.organizationId,
        social_account_id: account.id,
        platform,
        external_user_id: simUser,
        external_user_name: "Test console",
        channel: rule.trigger === "comment_received" ? "comment" : "dm",
        last_message_preview: "[simulation]",
      })
      .select("id")
      .single();
    if (convErr || !conv) throw new Error(convErr?.message ?? "conversation");

    const steps: SimStep[] = [];
    const seenRuns = new Set<string>();

    async function snapshot(label: string, follows: boolean | null, calls: { url: string; payload: Record<string, unknown> }[]) {
      const [{ data: runs }, { data: gate }] = await Promise.all([
        admin
          .from("automation_runs")
          .select("id, status, detail")
          .eq("conversation_id", conv!.id)
          .order("created_at", { ascending: true }),
        admin
          .from("automation_follow_gates")
          .select("status")
          .eq("conversation_id", conv!.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      const fresh = (runs ?? []).filter((r) => !seenRuns.has(r.id));
      fresh.forEach((r) => seenRuns.add(r.id));
      steps.push({
        label,
        follows,
        messages: calls.map((c) => ({ url: c.url.replace(/^https:\/\/[^/]+/, ""), ...describe(c.payload) })),
        runs: fresh.map((r) => ({ status: r.status, detail: r.detail })),
        gateStatus: gate?.status ?? null,
      });
    }

    async function tap(label: string, payload: string, follows: boolean | null) {
      const state = { follows, calls: [] as { url: string; payload: Record<string, unknown> }[] };
      await runSimulated(state, () =>
        handleFollowGateReply(admin, {
          organizationId: data.organizationId,
          conversationId: conv!.id,
          socialAccountId: account!.id,
          platform,
          externalUserId: simUser,
          payload,
          messageText: null,
          receivingExternalId: account!.external_id,
        }),
      );
      await snapshot(label, follows, state.calls);
      return state.calls;
    }

    const finalLinkSent = () =>
      steps.some((s) => s.runs.some((r) => r.status === "sent" && r.detail === "reply_dm"));

    try {
      const keyword = rule.keywords?.[0] ?? "test";
      const commentState = { follows: null as boolean | null, calls: [] as { url: string; payload: Record<string, unknown> }[] };
      await runSimulated(commentState, () =>
        runAutomations(admin, {
          organizationId: data.organizationId,
          conversationId: conv.id,
          socialAccountId: account.id,
          platform,
          channel: rule.trigger === "comment_received" ? "comment" : "dm",
          body: keyword,
          externalUserId: simUser,
          externalId: `sim_comment_${crypto.randomUUID().slice(0, 8)}`,
          postExternalId: rule.target_post_ids?.[0] ?? null,
        }),
      );
      await snapshot(`Comment "${keyword}" received`, null, commentState.calls);

      const opener = extractPayloads(commentState.calls).find((p) => p.includes(":opener:"))
        ?? extractPayloads(commentState.calls)[0];
      if (!opener) {
        return { pass: false, summary: "Stopped: no “Send me the link” button was produced", steps };
      }

      if (data.scenario === "expired") {
        await admin.from("automation_follow_gates").update({ status: "expired" }).eq("conversation_id", conv.id);
        await tap("Tap on an old/expired button", opener, true);
        const sent = finalLinkSent();
        return {
          pass: !sent,
          summary: sent ? "FAIL: expired button still delivered the link" : "Old button correctly blocked",
          steps,
        };
      }

      const followsAtTap = data.scenario === "follower" || data.scenario === "duplicate" ? true : data.scenario === "unknown" ? null : false;
      const tapCalls = await tap("Tap “Send me the link”", opener, followsAtTap);

      if (data.scenario === "duplicate") {
        await tap("Same tap delivered again by Meta", opener, true);
        const count = steps.flatMap((s) => s.runs).filter((r) => r.status === "sent" && r.detail === "reply_dm").length;
        return {
          pass: count === 1,
          summary: count === 1 ? "Final link sent exactly once" : `FAIL: final link sent ${count} times`,
          steps,
        };
      }

      if (!finalLinkSent()) {
        const confirm = extractPayloads(tapCalls).find((p) => p.includes(":confirm:"))
          ?? extractPayloads(tapCalls)[0];
        if (!confirm) {
          return { pass: false, summary: "Stopped: no “I followed” button was sent after the tap", steps };
        }
        await tap("User follows and taps “I followed”", confirm, true);
      }

      const pass = finalLinkSent();
      return {
        pass,
        summary: pass ? "Final link delivered" : `Stopped at: ${steps.at(-1)?.runs.at(-1)?.detail ?? "no action recorded"}`,
        steps,
      };
    } finally {
      await admin.from("automation_follow_gates").delete().eq("conversation_id", conv.id);
      await admin.from("automation_runs").delete().eq("conversation_id", conv.id);
      await admin.from("messages").delete().eq("conversation_id", conv.id);
      await admin.from("conversations").delete().eq("id", conv.id);
    }
  });
