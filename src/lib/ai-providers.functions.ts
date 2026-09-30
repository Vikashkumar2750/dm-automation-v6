import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Super-admin only. Keys are written through the service-role client and are
 * NEVER returned to the browser — reads answer with a masked summary only.
 */

const KEEP = "__keep__";

const saveSchema = z.object({
  enabled: z.boolean(),
  openRouterKeys: z.array(z.string().trim().max(400)).max(10),
  openRouterModel: z.string().trim().max(120),
  nvidiaKey: z.string().trim().max(400),
  nvidiaModel: z.string().trim().max(120),
  openAiKey: z.string().trim().max(400),
  openAiModel: z.string().trim().max(120),
  useLovableFallback: z.boolean(),
  maxCallsPerHour: z.number().int().min(1).max(20_000),
});

async function assertSuperAdmin(ctx: { supabase: unknown }) {
  const sb = ctx.supabase as import("@supabase/supabase-js").SupabaseClient;
  const { data } = await sb.rpc("current_user_has_platform_role", { _role: "super_admin" });
  if (!data) throw new Error("Forbidden");
}

export const getAiProviderStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { readAiProviders, describeAiProviders } = await import("@/lib/ai-providers.server");
    return describeAiProviders(await readAiProviders(supabaseAdmin));
  });

export const saveAiProviders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { AI_PROVIDERS_KEY, mergeAiProviders } = await import("@/lib/ai-providers.server");

    const { data: row } = await supabaseAdmin
      .from("platform_settings")
      .select("feature_flags")
      .eq("id", true)
      .maybeSingle();
    const flags = { ...((row?.feature_flags ?? {}) as Record<string, unknown>) };
    const current = mergeAiProviders(flags[AI_PROVIDERS_KEY]);

    // A blank or sentinel value means "leave the stored key untouched".
    const keep = (next: string, existing: string) =>
      !next || next === KEEP ? existing : next;

    const next = mergeAiProviders({
      enabled: data.enabled,
      openRouterKeys:
        data.openRouterKeys.length === 1 && data.openRouterKeys[0] === KEEP
          ? current.openRouterKeys
          : data.openRouterKeys.filter((k) => k && k !== KEEP),
      openRouterModel: data.openRouterModel,
      nvidiaKey: keep(data.nvidiaKey, current.nvidiaKey),
      nvidiaModel: data.nvidiaModel,
      openAiKey: keep(data.openAiKey, current.openAiKey),
      openAiModel: data.openAiModel,
      useLovableFallback: data.useLovableFallback,
      maxCallsPerHour: data.maxCallsPerHour,
    });

    flags[AI_PROVIDERS_KEY] = next;
    const { error } = await supabaseAdmin
      .from("platform_settings")
      .upsert({ id: true, feature_flags: flags, updated_at: new Date().toISOString() } as never, {
        onConflict: "id",
      });
    if (error) throw new Error(error.message);

    // Audit the change, never the key values.
    await supabaseAdmin.from("platform_audit_log").insert({
      actor_user_id: context.userId,
      action: "platform.ai_providers_updated",
      target_type: "platform",
      detail: {
        openRouterKeys: next.openRouterKeys.length,
        nvidia: Boolean(next.nvidiaKey),
        openai: Boolean(next.openAiKey),
        lovableFallback: next.useLovableFallback,
        maxCallsPerHour: next.maxCallsPerHour,
      },
    });
    return { ok: true };
  });

/** Runs one real prompt so the admin can see which provider answers. */
export const testAiProviders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { readAiProviders, generateWithFailover } = await import("@/lib/ai-providers.server");
    const config = await readAiProviders(supabaseAdmin);
    const result = await generateWithFailover({
      config,
      system: "Reply with one short friendly sentence.",
      prompt: "A viewer commented: 'Mast bnayi hai video'. Write the public reply.",
      scope: "admin-test",
    });
    return {
      provider: result.provider,
      sample: result.text?.slice(0, 200) ?? null,
      attempts: result.attempts.map((a) => ({ provider: a.provider, status: a.status, error: a.error })),
    };
  });
