import { resolveWorkspaceFeatures, type WorkspaceFeatures } from "@/lib/workspace-features";

/** Server-side read of a workspace's merged feature switches (Super Admin overrides included). */
export async function workspaceFeaturesFor(orgId: string, admin?: any): Promise<WorkspaceFeatures> {
  const db = admin ?? (await import("@/integrations/supabase/client.server")).supabaseAdmin;
  const { data } = await db.from("platform_settings").select("feature_flags").eq("id", true).maybeSingle();
  return resolveWorkspaceFeatures((data?.feature_flags ?? {}) as Record<string, unknown>, orgId);
}

/** Blocks changes when Sales & Revenue is view-only or hidden for this workspace. */
export async function assertRevenueWritable(orgId: string) {
  const f = await workspaceFeaturesFor(orgId);
  if (f.revenue !== "enabled") throw new Error(f.revenue === "view_only" ? "Sales & Revenue is view-only for this workspace." : "Sales & Revenue is not available for this workspace.");
}
