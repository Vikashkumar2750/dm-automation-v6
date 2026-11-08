import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const optionSchema = z.object({
  cycle: z.enum(["lifetime", "monthly", "half_yearly", "yearly"]),
  label: z.string().min(1).max(80),
  amountPaise: z.number().int().min(0).max(100_000_000),
  months: z.number().int().min(1).max(120).nullable(),
});
const planSchema = z.object({
  key: z.enum(["starter", "pro", "agency"]),
  name: z.string().min(1).max(40),
  headline: z.string().max(80),
  perks: z.array(z.string().max(160)).max(12),
  options: z.array(optionSchema).max(6),
  contactOnly: z.boolean().optional(),
  limits: z
    .object({
      monthlyDms: z.number().int().min(0).max(10_000_000).nullable(),
      maxRules: z.number().int().min(0).max(10_000).nullable(),
    })
    .optional(),
});
const configSchema = z.object({
  plans: z.array(planSchema).min(1).max(3),
  email: z.object({
    senderName: z.string().max(60),
    supportEmail: z.union([z.literal(""), z.string().email().max(200)]),
    adminAlertEmail: z.union([z.literal(""), z.string().email().max(200)]),
    events: z.record(z.string(), z.boolean()),
  }),
  passwordReset: z.object({
    perHour: z.number().int().min(1).max(50),
    perDay: z.number().int().min(1).max(200),
  }),
});

async function assertSuperAdmin(ctx: { supabase: unknown; userId: string }) {
  const sb = ctx.supabase as import("@supabase/supabase-js").SupabaseClient;
  const { data } = await sb.rpc("current_user_has_platform_role", { _role: "super_admin" });
  if (!data) throw new Error("Forbidden");
}

export const getPlatformConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { readPlatformConfig } = await import("@/lib/platform-config.server");
    return readPlatformConfig(supabaseAdmin);
  });

export const savePlatformConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => configSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { CONFIG_KEY } = await import("@/lib/platform-config.server");
    const { data: row, error: readError } = await supabaseAdmin
      .from("platform_settings")
      .select("feature_flags")
      .eq("id", true)
      .maybeSingle();
    if (readError) throw new Error("Configuration could not be loaded. No changes were saved.");
    const flags = {
      ...((row?.feature_flags ?? {}) as Record<string, unknown>),
      [CONFIG_KEY]: data,
    };
    const { error } = await supabaseAdmin
      .from("platform_settings")
      .upsert({ id: true, feature_flags: flags, updated_at: new Date().toISOString() } as never, {
        onConflict: "id",
      });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("platform_audit_log").insert({
      actor_user_id: context.userId,
      action: "platform.config_updated",
      target_type: "platform",
      detail: { sections: ["plans", "email", "passwordReset"] },
    });
    return { ok: true };
  });

/** Public: the plan catalogue shown on the billing page. */
export const getPublicPlans = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { readPlatformConfig } = await import("@/lib/platform-config.server");
  return (await readPlatformConfig(supabaseAdmin, { strictReads: true })).plans;
});

/** Public, rate-limited forgot-password request. Always answers the same way. */
export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({ email: z.string().trim().toLowerCase().email().max(200), origin: z.string().url() })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { readPlatformConfig } = await import("@/lib/platform-config.server");
    const { passwordReset } = await readPlatformConfig(supabaseAdmin);

    const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("platform_audit_log")
      .select("created_at")
      .eq("action", "auth.password_reset_requested")
      .eq("target_id", data.email)
      .gte("created_at", dayAgo)
      .limit(500);
    const hourAgo = Date.now() - 3_600_000;
    const lastHour = (recent ?? []).filter(
      (r) => new Date(r.created_at).getTime() > hourAgo,
    ).length;
    const lastDay = (recent ?? []).length;
    if (lastHour >= passwordReset.perHour || lastDay >= passwordReset.perDay) {
      return { ok: false as const, reason: "rate_limited" as const };
    }

    await supabaseAdmin.from("platform_audit_log").insert({
      action: "auth.password_reset_requested",
      target_type: "email",
      target_id: data.email,
      detail: {},
    });
    const { trustedOrigin } = await import("@/lib/allowed-origin.server");
    const origin = trustedOrigin(data.origin);
    await supabaseAdmin.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${origin}/reset-password`,
    });
    return { ok: true as const };
  });

export const getEmailProviderStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { emailProviderReady } = await import("@/lib/support-email.server");
    return { ready: emailProviderReady() };
  });

export const sendPlatformTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { readPlatformConfig } = await import("@/lib/platform-config.server");
    const { sendTestEmail } = await import("@/lib/support-email.server");
    const config = await readPlatformConfig(supabaseAdmin);
    return sendTestEmail(config.email.adminAlertEmail, config.email.senderName);
  });
