import type { SupabaseClient } from "@supabase/supabase-js";
import { effectiveWorkspacePlan, type EntitlementWorkspace } from "./workspace-entitlements";

export const ENTITLEMENT_COLUMNS = "plan, plan_expires_at, parent_organization_id, plan_source";

/** Call only after child membership is verified, or from trusted internal jobs. */
export async function resolveWorkspaceEntitlements(client: SupabaseClient, workspace: EntitlementWorkspace) {
  let parent: EntitlementWorkspace | null = null;
  if (workspace.parent_organization_id) {
    const { data, error } = await client.from("organizations").select(ENTITLEMENT_COLUMNS)
      .eq("id", workspace.parent_organization_id).maybeSingle();
    if (error) throw new Error("Unable to check Agency plan. Please try again.");
    parent = data;
  }
  return effectiveWorkspacePlan(workspace, parent);
}