import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

async function readFlags() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("platform_settings")
    .select("feature_flags")
    .eq("id", true)
    .maybeSingle();
  return { supabaseAdmin, flags: { ...((data?.feature_flags as Record<string, unknown> | null) ?? {}) } };
}

async function assertSuper(context: Ctx) {
  const { data } = await context.supabase.rpc("current_user_has_platform_role", { _role: "super_admin" });
  if (data !== true) throw new Error("Forbidden");
}

async function assertOrgRole(context: Ctx, orgId: string, roles: string[]) {
  const { data } = await context.supabase.rpc("current_user_has_org_role", { _org_id: orgId, _roles: roles });
  if (!data) throw new Error("not_allowed");
}

const orgInput = z.object({ organizationId: z.string().uuid() });

/** Super Admin: read the Phase A switch. */
export const getEntryPointsFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuper(context as Ctx);
    const { readEntryPointFlags } = await import("@/lib/entry-points.server");
    const { flags } = await readFlags();
    return readEntryPointFlags(flags);
  });

/** Super Admin: turn Phase A on/off, globally or for listed workspaces. */
export const saveEntryPointsFlags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ enabled: z.boolean(), orgs: z.array(z.string().uuid()).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuper(context as Ctx);
    const { supabaseAdmin, flags } = await readFlags();
    flags["entry_points_enabled"] = data.enabled;
    flags["entry_points_orgs"] = data.orgs;
    const { error } = await supabaseAdmin
      .from("platform_settings")
      .update({ feature_flags: flags as never })
      .eq("id", true);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("platform_audit_log").insert({
      actor_user_id: (context as Ctx).userId,
      action: "platform.entry_points_updated",
      target_type: "platform",
      target_id: null,
      detail: { enabled: data.enabled, orgs: data.orgs.length } as never,
    });
    return { ok: true };
  });

/** Workspace: is Phase A on for me, and my ice breakers / menu config. */
export const getEntryConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertOrgRole(context as Ctx, data.organizationId, ["owner", "admin", "manager", "agent", "viewer"]);
    const ep = await import("@/lib/entry-points.server");
    const { flags } = await readFlags();
    return {
      enabled: ep.entryPointsActiveFor(ep.readEntryPointFlags(flags), data.organizationId),
      config: ep.sanitizeEntryConfig(flags[ep.entryConfigKey(data.organizationId)]),
    };
  });

const configInput = orgInput.extend({
  iceBreakers: z.array(z.object({ question: z.string().trim().min(1).max(80) })).max(4),
  menu: z
    .array(z.object({ title: z.string().trim().min(1).max(30), url: z.string().trim().url().startsWith("https://").nullable() }))
    .max(5),
});

export const saveEntryConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => configInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertOrgRole(context as Ctx, data.organizationId, ["owner", "admin"]);
    const ep = await import("@/lib/entry-points.server");
    const { supabaseAdmin, flags } = await readFlags();
    if (!ep.entryPointsActiveFor(ep.readEntryPointFlags(flags), data.organizationId)) {
      throw new Error("entry_points_disabled");
    }
    flags[ep.entryConfigKey(data.organizationId)] = ep.sanitizeEntryConfig(data);
    const { error } = await supabaseAdmin
      .from("platform_settings")
      .update({ feature_flags: flags as never })
      .eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Manual only: push ice breakers / menu to every connected IG + FB account. */
export const syncEntryConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertOrgRole(context as Ctx, data.organizationId, ["owner", "admin"]);
    const ep = await import("@/lib/entry-points.server");
    const { supabaseAdmin, flags } = await readFlags();
    if (!ep.entryPointsActiveFor(ep.readEntryPointFlags(flags), data.organizationId)) {
      throw new Error("entry_points_disabled");
    }
    const cfg = ep.sanitizeEntryConfig(flags[ep.entryConfigKey(data.organizationId)]);
    const { data: accounts } = await supabaseAdmin
      .from("social_accounts")
      .select("id, platform, name, external_id")
      .eq("organization_id", data.organizationId)
      .in("platform", ["instagram", "facebook"]);

    const results: Array<{ account: string; platform: string; ok: boolean; error?: string }> = [];
    for (const acc of accounts ?? []) {
      const platform = acc.platform as "instagram" | "facebook";
      const { data: tok } = await supabaseAdmin
        .from("social_account_tokens")
        .select("access_token")
        .eq("social_account_id", acc.id)
        .maybeSingle();
      const token = (await (await import("@/lib/token-crypto.server")).readToken(tok?.access_token as string | undefined)) ?? undefined;
      const name = (acc.name as string | null) ?? platform;
      if (!token) {
        results.push({ account: name, platform, ok: false, error: "needs_reconnect" });
        continue;
      }
      const body = ep.messengerProfileBody(platform, cfg);
      const hosts = ["https://graph.facebook.com/v21.0"];
      if (platform === "instagram") hosts.push("https://graph.instagram.com/v21.0");
      let lastError = "unknown";
      let ok = false;
      // Empty config = remove what was published before (Meta rejects empty lists).
      const clearing = Object.keys(body).every((k) => k === "platform");
      const clearFields = platform === "facebook" ? ["ice_breakers", "persistent_menu"] : ["ice_breakers"];
      for (const host of hosts) {
        try {
          const qs = `access_token=${encodeURIComponent(token)}${platform === "instagram" ? "&platform=instagram" : ""}`;
          const res = await fetch(`${host}/me/messenger_profile?${qs}`, {
            method: clearing ? "DELETE" : "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(clearing ? { fields: clearFields, ...(platform === "instagram" ? { platform: "instagram" } : {}) } : body),
          });
          const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          if (res.ok && !json.error) { ok = true; break; }
          lastError = json.error?.message ?? `HTTP ${res.status}`;
        } catch (e) {
          lastError = (e as Error).message;
        }
      }
      results.push({ account: name, platform, ok, ...(ok ? {} : { error: lastError.slice(0, 200) }) });
    }
    return { results };
  });
