/**
 * Public-site settings stored in platform_settings.feature_flags.
 * Server-only. No secrets live here — tracking IDs and verification codes are public by nature.
 */
type AdminClient = import("@supabase/supabase-js").SupabaseClient;

export const SEO_TRACKING_KEY = "__seo_tracking";
export const AI_ASSISTANT_LIMIT_KEY = "__ai_assistant_daily_limit";
export const DEFAULT_AI_DAILY_LIMIT = 5;

export type SeoTracking = {
  ga4Id: string;
  gtmId: string;
  adsenseId: string;
  metaPixelId: string;
  googleVerification: string;
  bingVerification: string;
  requireConsent: boolean;
};

export const EMPTY_TRACKING: SeoTracking = {
  ga4Id: "",
  gtmId: "",
  adsenseId: "",
  metaPixelId: "",
  googleVerification: "",
  bingVerification: "",
  requireConsent: true,
};

export const TRACKING_PATTERNS: Record<Exclude<keyof SeoTracking, "requireConsent">, RegExp> = {
  ga4Id: /^G-[A-Z0-9]{4,20}$/,
  gtmId: /^GTM-[A-Z0-9]{4,12}$/,
  adsenseId: /^ca-pub-\d{10,20}$/,
  metaPixelId: /^\d{8,20}$/,
  googleVerification: /^[A-Za-z0-9_-]{10,100}$/,
  bingVerification: /^[A-Za-z0-9]{10,64}$/,
};

export function cleanTracking(raw: unknown): SeoTracking {
  const input = (raw ?? {}) as Record<string, unknown>;
  const out: SeoTracking = { ...EMPTY_TRACKING };
  for (const key of Object.keys(TRACKING_PATTERNS) as (keyof typeof TRACKING_PATTERNS)[]) {
    const value = typeof input[key] === "string" ? (input[key] as string).trim() : "";
    out[key] = TRACKING_PATTERNS[key].test(value) ? value : "";
  }
  out.requireConsent = input.requireConsent !== false;
  return out;
}

async function readFlags(admin: AdminClient): Promise<Record<string, unknown>> {
  const { data } = await admin
    .from("platform_settings")
    .select("feature_flags")
    .eq("id", true)
    .maybeSingle();
  return (data?.feature_flags ?? {}) as Record<string, unknown>;
}

export async function writeFlag(admin: AdminClient, key: string, value: unknown) {
  const flags = await readFlags(admin);
  const { error } = await admin
    .from("platform_settings")
    .update({ feature_flags: { ...flags, [key]: value } as never })
    .eq("id", true);
  if (error) throw new Error(error.message);
}

let trackingCache: { at: number; value: SeoTracking } | null = null;

export async function readTracking(admin: AdminClient, fresh = false): Promise<SeoTracking> {
  if (!fresh && trackingCache && Date.now() - trackingCache.at < 300_000) return trackingCache.value;
  const value = cleanTracking((await readFlags(admin))[SEO_TRACKING_KEY]);
  trackingCache = { at: Date.now(), value };
  return value;
}

export function clearTrackingCache() {
  trackingCache = null;
}

export async function readAiDailyLimit(admin: AdminClient): Promise<number> {
  const raw = (await readFlags(admin))[AI_ASSISTANT_LIMIT_KEY];
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.min(Math.floor(n), 1000) : DEFAULT_AI_DAILY_LIMIT;
}
