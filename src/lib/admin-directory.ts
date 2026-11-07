import { csvCell } from "./csv-safe";

type WorkspaceRow = { name: string; slug: string; plan: string; automationsPaused: boolean; accounts: number; created_at: string; ownerName?: string | null; ownerEmail?: string | null; effectivePlan?: string; planExpiresAt?: string | null };

type ExportWorkspaceRow = WorkspaceRow & { id: string; members: number; conversations: number; posts: number; inherited?: boolean; parentId?: string | null; parentName?: string | null };

/** Export only the authorized, already-filtered snapshot; never fetch extra tenants. */
export function adminWorkspacesToCsv(rows: ExportWorkspaceRow[]): string {
  const headers = ["Workspace ID", "Workspace", "Slug", "Owner name", "Owner email", "Assigned plan", "Effective plan", "Plan expiry (UTC)", "Inherited access", "Parent workspace ID", "Parent workspace", "Members", "Accounts", "Threads", "Posts", "Automation status", "Created (UTC)"];
  const values = rows.map((row) => [row.id, row.name, row.slug, row.ownerName, row.ownerEmail, row.plan, row.effectivePlan ?? row.plan, row.planExpiresAt, row.inherited ? "Yes" : "No", row.parentId, row.parentName, row.members, row.accounts, row.conversations, row.posts, row.automationsPaused ? "Paused" : "Active", row.created_at]);
  return [headers, ...values].map((cells) => cells.map(csvCell).join(",")).join("\r\n");
}

export function filterAdminWorkspaces<T extends WorkspaceRow>(rows: T[], search: string, plan: string, status: string, sort: string, expiry = "all", now = Date.now()): T[] {
  const term = search.trim().toLowerCase();
  return rows.filter((row) =>
    (!term || [row.name, row.slug, row.ownerName ?? "", row.ownerEmail ?? ""].some((value) => value.toLowerCase().includes(term))) &&
    (plan === "all" || (row.effectivePlan ?? row.plan) === plan) &&
    (status === "all" || (status === "paused" ? row.automationsPaused : !row.automationsPaused)) &&
    (expiry === "all" || (row.planExpiresAt && (expiry === "expired" ? new Date(row.planExpiresAt).getTime() <= now : new Date(row.planExpiresAt).getTime() > now && new Date(row.planExpiresAt).getTime() <= now + 7 * 86400000))),
  ).sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "accounts" ? b.accounts - a.accounts : b.created_at.localeCompare(a.created_at));
}