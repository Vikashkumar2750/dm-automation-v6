import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { overridesKey, resolveWorkspaceFeatures, sanitizeOverrides, type FeatureOverrides } from "@/lib/workspace-features";

async function readFlags(): Promise<Record<string, unknown>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("platform_settings").select("feature_flags").eq("id", true).maybeSingle();
  return (data?.feature_flags ?? {}) as Record<string, unknown>;
}

/** Signed-in member: the merged feature switches for one of their workspaces. */
export const getWorkspaceFeatures = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid().nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    let orgId: string | null = null;
    if (data.orgId) {
      // RLS: only returns the workspace when the caller is a member.
      const { data: org } = await context.supabase.from("organizations").select("id").eq("id", data.orgId).maybeSingle();
      orgId = org?.id ?? null;
    }
    return resolveWorkspaceFeatures(await readFlags(), orgId);
  });

async function assertSuperAdmin(context: { supabase: any }) {
  const { data } = await context.supabase.rpc("current_user_has_platform_role", { _role: "super_admin" });
  if (!data) throw new Error("forbidden");
}

export const adminGetWorkspaceFeatures = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const flags = await readFlags();
    const overrides = (flags[overridesKey(data.orgId)] ?? {}) as FeatureOverrides;
    return { overrides, resolved: resolveWorkspaceFeatures(flags, data.orgId), platform: resolveWorkspaceFeatures(flags, null) };
  });

export const adminSetWorkspaceFeatures = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid(), overrides: z.record(z.string(), z.unknown()) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const flags = await readFlags();
    const clean = sanitizeOverrides(data.overrides);
    const next = { ...flags, [overridesKey(data.orgId)]: clean };
    const { error } = await supabaseAdmin.from("platform_settings").upsert({ id: true, feature_flags: next, updated_at: new Date().toISOString() } as never, { onConflict: "id" });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("platform_audit_log").insert({ actor_user_id: context.userId, action: "platform.workspace_features", target_type: "organization", target_id: data.orgId, detail: { keys: Object.keys(clean) } });
    return { ok: true };
  });

/** Read-only health summary for one workspace (counts and statuses only, no message contents). */
export const adminWorkspaceHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin: a } = await import("@/integrations/supabase/client.server");
    const org = data.orgId;
    const [cred, otp, pages, paid, errors] = await Promise.all([
      a.from("payment_credentials").select("organization_id").eq("organization_id", org).maybeSingle(),
      a.from("whatsapp_otp_settings").select("organization_id").eq("organization_id", org).maybeSingle(),
      a.from("delivery_pages").select("id").eq("organization_id", org),
      a.from("payment_links").select("amount_paise").eq("organization_id", org).eq("status", "paid").limit(5000),
      a.from("automation_runs").select("id, created_at, status, detail").eq("organization_id", org).eq("status", "failed" as never).order("created_at", { ascending: false }).limit(10),
    ]);
    const pageIds = (pages.data ?? []).map((p: any) => p.id as string);
    let completed = 0, dropped = 0;
    if (pageIds.length) {
      const { data: leads } = await a.from("delivery_page_leads").select("answers").in("delivery_page_id", pageIds).limit(5000);
      for (const l of leads ?? []) ((l.answers as any)?._stage === "completed" ? completed++ : dropped++);
    }
    return {
      razorpayConnected: !!cred.data,
      whatsappOtpConnected: !!otp.data,
      deliveryPages: pageIds.length,
      leads: { completed, dropped },
      paidOrders: (paid.data ?? []).length,
      revenuePaise: (paid.data ?? []).reduce((s: number, r: any) => s + Number(r.amount_paise || 0), 0),
      recentErrors: (errors.data ?? []).map((e: any) => ({ id: e.id as string, at: e.created_at as string, error: String(e.detail ?? "Failed").slice(0, 200) })),
    };
  });
