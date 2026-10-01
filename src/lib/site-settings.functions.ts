import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> } };

async function assertSuperAdmin(context: Ctx) {
  const { data, error } = await context.supabase.rpc("current_user_has_platform_role", { _role: "super_admin" });
  if (error || !data) throw new Error("forbidden");
}

/** Public: tracking IDs and verification codes only (public by nature). */
export const getPublicTracking = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { readTracking } = await import("@/lib/site-settings.server");
    return await readTracking(supabaseAdmin);
  } catch {
    const { EMPTY_TRACKING } = await import("@/lib/site-settings.server");
    return EMPTY_TRACKING;
  }
});

export const getSiteSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context as unknown as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await import("@/lib/site-settings.server");
    return {
      tracking: await s.readTracking(supabaseAdmin, true),
      aiDailyLimit: await s.readAiDailyLimit(supabaseAdmin),
    };
  });

const idField = z.string().trim().max(120).optional().default("");

export const saveSiteSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        tracking: z.object({
          ga4Id: idField,
          gtmId: idField,
          adsenseId: idField,
          metaPixelId: idField,
          googleVerification: idField,
          bingVerification: idField,
          requireConsent: z.boolean(),
        }),
        aiDailyLimit: z.number().int().min(0).max(1000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context as unknown as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await import("@/lib/site-settings.server");
    const invalid = (Object.keys(s.TRACKING_PATTERNS) as (keyof typeof s.TRACKING_PATTERNS)[]).filter(
      (k) => data.tracking[k] && !s.TRACKING_PATTERNS[k].test(data.tracking[k]),
    );
    if (invalid.length) throw new Error(`Invalid format: ${invalid.join(", ")}`);
    await s.writeFlag(supabaseAdmin, s.SEO_TRACKING_KEY, s.cleanTracking(data.tracking));
    await s.writeFlag(supabaseAdmin, s.AI_ASSISTANT_LIMIT_KEY, data.aiDailyLimit);
    s.clearTrackingCache();
    return { ok: true };
  });
