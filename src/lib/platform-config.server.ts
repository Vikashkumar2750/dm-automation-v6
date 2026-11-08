import { PLANS, type PlanDef } from "@/lib/plans";
import { configuredPlanOption } from "@/lib/plan-presentation";

type AdminClient = import("@supabase/supabase-js").SupabaseClient;

/** Stored inside platform_settings.feature_flags under this key (non-boolean). */
export const CONFIG_KEY = "__config";

export type EmailEvents = {
  new_signup: boolean;
  payment_received: boolean;
  automation_failure: boolean;
  account_disconnected: boolean;
  support_inquiry: boolean;
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
    senderName: "AutoDM by Techaasvik",
    supportEmail: "",
    adminAlertEmail: "",
    events: {
      new_signup: true,
      payment_received: true,
      automation_failure: true,
      account_disconnected: true,
      support_inquiry: true,
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

export async function readPlatformConfig(
  admin: AdminClient,
  options: { strictReads?: boolean } = {},
): Promise<PlatformConfig> {
  const { data, error } = await admin
    .from("platform_settings")
    .select("feature_flags")
    .eq("id", true)
    .maybeSingle();
  if (options.strictReads && error)
    throw new Error("Plan catalogue unavailable. Refresh to retry.");
  const flags = (data?.feature_flags ?? {}) as Record<string, unknown>;
  return mergeConfig(flags[CONFIG_KEY]);
}

export async function findConfiguredOption(admin: AdminClient, plan: string, cycle: string) {
  const config = await readPlatformConfig(admin, { strictReads: true });
  return configuredPlanOption(config.plans, plan, cycle);
}
