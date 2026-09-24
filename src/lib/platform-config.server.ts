import { PLANS, type PlanDef } from "@/lib/plans";

type AdminClient = import("@supabase/supabase-js").SupabaseClient;

/** Stored inside platform_settings.feature_flags under this key (non-boolean). */
export const CONFIG_KEY = "__config";

export type EmailEvents = {
  new_signup: boolean;
  payment_received: boolean;
  automation_failure: boolean;
  account_disconnected: boolean;
  plan_expiring: boolean;
  workspace_suspended: boolean;
};

export type PlatformConfig = {
  plans: PlanDef[];
  email: {
    senderName: string;
    supportEmail: string;
    adminAlertEmail: string;
    events: EmailEvents;
  };
  passwordReset: { perHour: number; perDay: number };
};

export const DEFAULT_CONFIG: PlatformConfig = {
  plans: PLANS,
  email: {
    senderName: "Techaasvik",
    supportEmail: "",
    adminAlertEmail: "",
    events: {
      new_signup: true,
      payment_received: true,
      automation_failure: true,
      account_disconnected: true,
      plan_expiring: true,
      workspace_suspended: true,
    },
  },
  passwordReset: { perHour: 3, perDay: 5 },
};

export function mergeConfig(raw: unknown): PlatformConfig {
  const c = (raw && typeof raw === "object" ? raw : {}) as Partial<PlatformConfig>;
  return {
    plans: Array.isArray(c.plans) && c.plans.length > 0 ? c.plans : DEFAULT_CONFIG.plans,
    email: {
      ...DEFAULT_CONFIG.email,
      ...(c.email ?? {}),
      events: { ...DEFAULT_CONFIG.email.events, ...(c.email?.events ?? {}) },
    },
    passwordReset: { ...DEFAULT_CONFIG.passwordReset, ...(c.passwordReset ?? {}) },
  };
}

export async function readPlatformConfig(admin: AdminClient): Promise<PlatformConfig> {
  const { data } = await admin
    .from("platform_settings")
    .select("feature_flags")
    .eq("id", true)
    .maybeSingle();
  const flags = (data?.feature_flags ?? {}) as Record<string, unknown>;
  return mergeConfig(flags[CONFIG_KEY]);
}

export async function findConfiguredOption(admin: AdminClient, plan: string, cycle: string) {
  const config = await readPlatformConfig(admin);
  return (
    config.plans.find((p) => p.key === plan)?.options.find((o) => o.cycle === cycle) ?? null
  );
}
