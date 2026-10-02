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

function flowsActive(flags: Record<string, unknown>, orgId: string) {
  if (flags["flows_enabled"] !== true) return false;
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
      enabled: flags["flows_enabled"] === true,
      orgs: Array.isArray(flags["flows_orgs"]) ? (flags["flows_orgs"] as string[]) : [],
    };
  });

export const saveFlowsFlags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ enabled: z.boolean(), orgs: z.array(z.string().uuid()).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuper(context as Ctx);
    const { supabaseAdmin, flags } = await readFlags();
    flags["flows_enabled"] = data.enabled;
    flags["flows_orgs"] = data.orgs;
    const { error } = await supabaseAdmin.from("platform_settings").update({ feature_flags: flags as never }).eq("id", true);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("platform_audit_log").insert({
      actor_user_id: (context as Ctx).userId,
      action: "platform.flows_updated",
      target_type: "platform",
      target_id: null,
      detail: { enabled: data.enabled, orgs: data.orgs.length } as never,
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
    return { enabled: flowsActive(flags, data.organizationId), flows: sanitizeFlows(flags[flowsKey(data.organizationId)]) };
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
    const { error } = await supabaseAdmin.from("platform_settings").update({ feature_flags: flags as never }).eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true, flows };
  });
