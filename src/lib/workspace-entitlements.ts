export type EntitlementWorkspace = {
  plan: string;
  plan_expires_at?: string | null;
  parent_organization_id?: string | null;
  plan_source?: string | null;
};

/** Parent benefits are derived, never an independent permanent Agency grant. */
export function effectiveWorkspacePlan(
  workspace: EntitlementWorkspace,
  parent: EntitlementWorkspace | null = null,
  now = Date.now(),
): { plan: string; plan_expires_at: string | null; inherited: boolean } {
  const active = (org: EntitlementWorkspace) =>
    !org.plan_expires_at || new Date(org.plan_expires_at).getTime() > now;
  if (workspace.parent_organization_id && parent?.plan === "agency" &&
      !parent.parent_organization_id && active(parent)) {
    return { plan: "agency", plan_expires_at: parent.plan_expires_at ?? null, inherited: true };
  }
  const inheritedGrant = workspace.plan_source === "agency_parent";
  const plan = inheritedGrant || (workspace.plan !== "starter" && !active(workspace))
    ? "starter" : workspace.plan;
  return { plan, plan_expires_at: inheritedGrant ? null : workspace.plan_expires_at ?? null, inherited: false };
}

export function socialAccountLimit(plan: string): number | null {
  return plan === "agency" ? null : plan === "pro" ? 5 : 1;
}