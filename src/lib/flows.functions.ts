import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

const flowsKey = (orgId: string) => `flows_cfg_${orgId}`;

async function readFlags() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("platform_settings").select("feature_flags").eq("id", true).maybeSingle();
  return { supabaseAdmin, flags: { ...((data?.feature_flags as Record<string, unknown> | null) ?? {}) } };
}

// Default-on, matching the admin panel (getFlowsFlags) and the live runner:
// flows are available to every workspace unless a Super Admin explicitly turns them off.
function flowsActive(flags: Record<string, unknown>, orgId: string) {
  if (flags["flows_enabled"] === false) return false;
  const orgs = Array.isArray(flags["flows_orgs"]) ? (flags["flows_orgs"] as string[]) : [];
  return orgs.length === 0 || orgs.includes(orgId);
}

async function assertSuper(context: Ctx) {
  const { data } = await context.supabase.rpc("current_user_has_platform_role", { _role: "super_admin" });
  if (data !== true) throw new Error("Forbidden");
}

async function assertOrgRole(context: Ctx, orgId: string, roles: string[]) {
  const { data } = await context.supabase.rpc("current_user_has_org_role", { _org_id: orgId, _roles: roles });
  if (!data) throw new Error("not_allowed");
}

export const getFlowsFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuper(context as Ctx);
    const { flags } = await readFlags();
    return {
      enabled: flags["flows_enabled"] !== false,
      orgs: Array.isArray(flags["flows_orgs"]) ? (flags["flows_orgs"] as string[]) : [],
      live: flags["flows_live_enabled"] !== false,
      liveOrgs: Array.isArray(flags["flows_live_orgs"]) ? (flags["flows_live_orgs"] as string[]) : [],
    };
  });

export const saveFlowsFlags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    enabled: z.boolean(),
    orgs: z.array(z.string().uuid()).max(500),
    live: z.boolean().default(false),
    liveOrgs: z.array(z.string().uuid()).max(500).default([]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuper(context as Ctx);
    const { supabaseAdmin, flags } = await readFlags();
    flags["flows_enabled"] = data.enabled;
    flags["flows_orgs"] = data.orgs;
    flags["flows_live_enabled"] = data.live;
    flags["flows_live_orgs"] = data.liveOrgs;
    const { error } = await supabaseAdmin.from("platform_settings").upsert({ id: true, feature_flags: flags as never });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("platform_audit_log").insert({
      actor_user_id: (context as Ctx).userId,
      action: "platform.flows_updated",
      target_type: "platform",
      target_id: null,
      detail: { enabled: data.enabled, orgs: data.orgs.length, live: data.live, liveOrgs: data.liveOrgs.length } as never,
    });
    return { ok: true };
  });

const orgInput = z.object({ organizationId: z.string().uuid() });

export const getFlows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertOrgRole(context as Ctx, data.organizationId, ["owner", "admin", "manager", "agent", "viewer"]);
    const { sanitizeFlows } = await import("@/lib/flows");
    const { flags } = await readFlags();
    const { liveFlowsActive } = await import("@/lib/flows-runner.server");
    return { enabled: flowsActive(flags, data.organizationId), live: liveFlowsActive(flags, data.organizationId), flows: sanitizeFlows(flags[flowsKey(data.organizationId)]) };
  });

export const saveFlows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgInput.extend({ flows: z.array(z.unknown()).max(20) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOrgRole(context as Ctx, data.organizationId, ["owner", "admin", "manager"]);
    const { sanitizeFlows, validateFlow } = await import("@/lib/flows");
    const { supabaseAdmin, flags } = await readFlags();
    if (!flowsActive(flags, data.organizationId)) throw new Error("flows_disabled");
    // A flow with problems can be saved as a draft, but never stays active.
    const flows = sanitizeFlows(data.flows).map((f) => ({ ...f, active: f.active && validateFlow(f).length === 0 }));
    flags[flowsKey(data.organizationId)] = flows;
    const { error } = await supabaseAdmin.from("platform_settings").upsert({ id: true, feature_flags: flags as never });
    if (error) throw new Error(error.message);
    return { ok: true, flows };
  });

const AI_KEY = (orgId: string) => `flow_ai_last_${orgId}`;
const AI_WINDOW_MS = 24 * 3600_000;

/** AI flow suggestion: active Agency plan only, one generated flow per workspace per 24 hours. */
async function aiFlowStatus(admin: any, flags: Record<string, unknown>, orgId: string) {
  const { data: org } = await admin.from("organizations").select("plan, plan_expires_at").eq("id", orgId).maybeSingle();
  const expired = org?.plan_expires_at && new Date(org.plan_expires_at as string) < new Date();
  const allowed = org?.plan === "agency" && !expired;
  const last = typeof flags[AI_KEY(orgId)] === "string" ? Date.parse(flags[AI_KEY(orgId)] as string) : NaN;
  const nextAt = Number.isFinite(last) && Date.now() - last < AI_WINDOW_MS ? new Date(last + AI_WINDOW_MS).toISOString() : null;
  return { allowed, nextAt };
}

export const getFlowAiStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertOrgRole(context as Ctx, data.organizationId, ["owner", "admin", "manager", "agent", "viewer"]);
    const { supabaseAdmin, flags } = await readFlags();
    return aiFlowStatus(supabaseAdmin, flags, data.organizationId);
  });

export const suggestFlowWithAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgInput.extend({
    goal: z.string().max(400).default(""),
    current: z.unknown().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOrgRole(context as Ctx, data.organizationId, ["owner", "admin", "manager"]);
    const { supabaseAdmin, flags } = await readFlags();
    const status = await aiFlowStatus(supabaseAdmin, flags, data.organizationId);
    if (!status.allowed) return { error: "agency_only" as const };
    if (status.nextAt) return { error: "daily_limit" as const, nextAt: status.nextAt };
    const { readAiProviders, generateWithFailover, sanitisePromptInput } = await import("@/lib/ai-providers.server");
    const { sanitizeFlows, TAG_PRESETS } = await import("@/lib/flows");
    const current = sanitizeFlows(data.current ? [data.current] : [])[0];
    const system = `You design Instagram/Facebook comment & DM automation flows. Reply with ONLY one JSON object:
{"name":string,"trigger":"new_comment"|"new_dm"|"story_reply"|"story_mention","explanation":string,"steps":[...]}
Allowed steps (max 14):
{"kind":"condition","check":"contains"|"not_contains","value":"comma keywords"}
{"kind":"condition","check":"is_follower","value":"yes"|"no"}
{"kind":"condition","check":"has_tag"|"no_tag","value":"tag"}
{"kind":"condition","check":"has_contact","value":"email"|"phone"|"any"|"none"}
{"kind":"send_dm","text":string,"buttonTitle"?:string,"buttonUrl"?:"https://..."}
{"kind":"public_reply","text":string} (only for new_comment)
{"kind":"wait","minutes":number}
{"kind":"tag"|"remove_tag","value":string}
{"kind":"ask_contact","text":string}
{"kind":"follow_gate","text":string,"buttonTitle":"Visit profile","profileUrl":"https://instagram.com/yourprofile"}
{"kind":"send_payment","productId":"","text":string}
{"kind":"send_coupon","campaignId":"","text":"... {code} ..."}
Prefer tags from: ${TAG_PRESETS.join(", ")}. Use example.com for links. Keep messages short and friendly.`;
    const prompt = `Goal: ${sanitisePromptInput(data.goal || "Improve conversions and capture leads", 400)}
${current ? `Current flow to improve (suggest what to add next, return the full improved flow): ${JSON.stringify({ trigger: current.trigger, steps: current.steps.map(({ id: _i, ...s }) => s) }).slice(0, 2500)}` : "Create a new flow."}`;
    const config = await readAiProviders(supabaseAdmin);
    const res = await generateWithFailover({ config, system, prompt, scope: `flow-ai:${data.organizationId}`, long: true });
    if (!res.text) return { error: "ai_unavailable" as const };
    const m = res.text.match(/\{[\s\S]*\}/);
    let parsed: any = null;
    try { parsed = m ? JSON.parse(m[0]) : null; } catch { parsed = null; }
    const flow = sanitizeFlows(parsed ? [{ ...parsed, active: false }] : [])[0];
    if (!flow || flow.steps.length === 0) return { error: "ai_bad_answer" as const };
    flags[AI_KEY(data.organizationId)] = new Date().toISOString();
    await supabaseAdmin.from("platform_settings").upsert({ id: true, feature_flags: flags as never });
    return { flow: { ...flow, name: flow.name || "AI suggested flow" }, explanation: String(parsed?.explanation ?? "").slice(0, 600) };
  });
