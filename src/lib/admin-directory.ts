type WorkspaceRow = { name: string; slug: string; plan: string; automationsPaused: boolean; accounts: number; created_at: string };

export function filterAdminWorkspaces<T extends WorkspaceRow>(rows: T[], search: string, plan: string, status: string, sort: string): T[] {
  const term = search.trim().toLowerCase();
  return rows.filter((row) =>
    (!term || row.name.toLowerCase().includes(term) || row.slug.toLowerCase().includes(term)) &&
    (plan === "all" || row.plan === plan) &&
    (status === "all" || (status === "paused" ? row.automationsPaused : !row.automationsPaused)),
  ).sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "accounts" ? b.accounts - a.accounts : b.created_at.localeCompare(a.created_at));
}