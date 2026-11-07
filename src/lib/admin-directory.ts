type WorkspaceRow = { name: string; slug: string; plan: string; automationsPaused: boolean; accounts: number; created_at: string; ownerName?: string | null; ownerEmail?: string | null; effectivePlan?: string; planExpiresAt?: string | null };

export function filterAdminWorkspaces<T extends WorkspaceRow>(rows: T[], search: string, plan: string, status: string, sort: string, expiry = "all", now = Date.now()): T[] {
  const term = search.trim().toLowerCase();
  return rows.filter((row) =>
    (!term || [row.name, row.slug, row.ownerName ?? "", row.ownerEmail ?? ""].some((value) => value.toLowerCase().includes(term))) &&
    (plan === "all" || (row.effectivePlan ?? row.plan) === plan) &&
    (status === "all" || (status === "paused" ? row.automationsPaused : !row.automationsPaused)) &&
    (expiry === "all" || (row.planExpiresAt && (expiry === "expired" ? new Date(row.planExpiresAt).getTime() <= now : new Date(row.planExpiresAt).getTime() > now && new Date(row.planExpiresAt).getTime() <= now + 7 * 86400000))),
  ).sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "accounts" ? b.accounts - a.accounts : b.created_at.localeCompare(a.created_at));
}