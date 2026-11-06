/** Per-workspace feature switches set by Super Admin (pure, client-safe). */
import { publishingMode, type PublishingMode } from "@/lib/publishing-availability";

export type OnOff = "enabled" | "off";
export type RevenueMode = "enabled" | "view_only" | "hidden";

export type WorkspaceFeatures = {
  revenue: RevenueMode;
  create_post: PublishingMode;
  calendar: PublishingMode;
  ai: OnOff;
  workflows: OnOff;
  team_desk: OnOff;
  growth: OnOff;
  whatsapp_otp: OnOff;
  delivery_pages: OnOff;
  emails: OnOff;
};
export type FeatureKey = keyof WorkspaceFeatures;
/** Saved override: a value, or absent = use platform default. Plus an optional monthly AI request cap. */
export type FeatureOverrides = Partial<WorkspaceFeatures> & { ai_monthly_cap?: number | null };

export const FEATURE_OPTIONS: Record<FeatureKey, { label: string; description: string; options: { value: string; label: string }[] }> = {
  revenue: { label: "Sales & Revenue", description: "Products, coupons, delivery pages and payments.", options: [{ value: "enabled", label: "Enabled" }, { value: "view_only", label: "View only" }, { value: "hidden", label: "Hidden" }] },
  create_post: { label: "Create Post", description: "Publishing posts to connected accounts.", options: [{ value: "enabled", label: "Enabled" }, { value: "coming_soon", label: "Coming soon" }, { value: "hidden", label: "Hidden" }] },
  calendar: { label: "Calendar", description: "Content calendar.", options: [{ value: "enabled", label: "Enabled" }, { value: "coming_soon", label: "Coming soon" }, { value: "hidden", label: "Hidden" }] },
  ai: { label: "AI assistant & AI agent", description: "AI captions, drafts and AI DM replies.", options: [{ value: "enabled", label: "Enabled" }, { value: "off", label: "Off" }] },
  workflows: { label: "Workflows", description: "Post-wise workflow view.", options: [{ value: "enabled", label: "Enabled" }, { value: "off", label: "Off" }] },
  team_desk: { label: "Team Desk", description: "Shared team inbox tools.", options: [{ value: "enabled", label: "Enabled" }, { value: "off", label: "Off" }] },
  growth: { label: "Growth Insights", description: "Growth and competitor insights.", options: [{ value: "enabled", label: "Enabled" }, { value: "off", label: "Off" }] },
  whatsapp_otp: { label: "WhatsApp OTP on lead forms", description: "Phone verification on delivery page forms.", options: [{ value: "enabled", label: "Enabled" }, { value: "off", label: "Off" }] },
  delivery_pages: { label: "Delivery pages", description: "Public delivery/sales pages and checkout.", options: [{ value: "enabled", label: "Enabled" }, { value: "off", label: "Off" }] },
  emails: { label: "Emails to buyers & leads", description: "Receipts, lead confirmations, creator alerts and outreach emails.", options: [{ value: "enabled", label: "Enabled" }, { value: "off", label: "Off" }] },
};

export const FEATURE_KEYS = Object.keys(FEATURE_OPTIONS) as FeatureKey[];

export const overridesKey = (orgId: string) => `org_features_${orgId}`;

/** Platform defaults first, then the workspace override wins. */
export function resolveWorkspaceFeatures(flags: Record<string, unknown>, orgId?: string | null): WorkspaceFeatures {
  const base: WorkspaceFeatures = {
    revenue: "enabled",
    create_post: publishingMode(flags, "create_post"),
    calendar: publishingMode(flags, "calendar"),
    ai: flags["ai_assistant"] === false ? "off" : "enabled",
    workflows: flags["workflows_enabled"] === true ? "enabled" : "off",
    team_desk: "enabled",
    growth: "enabled",
    whatsapp_otp: "enabled",
    delivery_pages: "enabled",
    emails: "enabled",
  };
  const raw = orgId ? flags[overridesKey(orgId)] : null;
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const out = { ...base } as Record<FeatureKey, string>;
  for (const k of FEATURE_KEYS) {
    const v = o[k];
    if (typeof v === "string" && FEATURE_OPTIONS[k].options.some((x) => x.value === v)) out[k] = v;
  }
  return out as WorkspaceFeatures;
}

/** Clean an override object coming from the admin form. */
export function sanitizeOverrides(input: Record<string, unknown>): FeatureOverrides {
  const out: Record<string, unknown> = {};
  for (const k of FEATURE_KEYS) {
    const v = input[k];
    if (typeof v === "string" && FEATURE_OPTIONS[k].options.some((x) => x.value === v)) out[k] = v;
  }
  const cap = Number(input["ai_monthly_cap"]);
  if (Number.isInteger(cap) && cap >= 0 && cap <= 1_000_000) out["ai_monthly_cap"] = cap;
  return out as FeatureOverrides;
}

export function featureOn(f: WorkspaceFeatures, key: FeatureKey): boolean {
  const v = f[key];
  return v === "enabled" || v === "view_only";
}
