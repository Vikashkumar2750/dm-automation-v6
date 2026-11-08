import type { AutomationRun } from "@/lib/automations.functions";
export { activitySource as notificationSource } from "@/lib/activity-explain";

export function notificationStorageKey(userId: string, orgId: string) {
  return `autodm.notifications.read:${userId}:${orgId}`;
}

export type WorkspaceAttention = {
  id: string;
  kind: "accounts" | "messages" | "posts";
  count: number;
  to: "/social-accounts" | "/inbox" | "/create-post";
};

/** Only confirmed source reads can produce attention items. */
export function workspaceAttention(input: {
  accounts?: { id: string; status: string }[] | undefined;
  unread?: number | undefined;
  posts?: { id: string; status: string }[] | undefined;
  postsVisible: boolean;
}): WorkspaceAttention[] {
  const items: WorkspaceAttention[] = [];
  if (input.accounts) {
    const affected = input.accounts.filter((a) => a.status !== "connected");
    if (!input.accounts.length || affected.length) {
      items.push({ id: `attention:accounts:${affected.map((a) => `${a.id}:${a.status}`).sort().join(",") || "empty"}`, kind: "accounts", count: affected.length, to: "/social-accounts" });
    }
  }
  if (input.unread && input.unread > 0) {
    items.push({ id: `attention:messages:${input.unread}`, kind: "messages", count: input.unread, to: "/inbox" });
  }
  const failed = input.posts?.filter((p) => p.status === "failed") ?? [];
  if (input.postsVisible && failed.length) {
    items.push({ id: `attention:posts:${failed.map((p) => p.id).sort().join(",")}`, kind: "posts", count: failed.length, to: "/create-post" });
  }
  return items;
}

/** Every skipped/failed step is actionable, even when another step in its run sent. */
export function notificationRuns(runs: AutomationRun[], now: number) {
  return runs.filter((run) => (run.status === "skipped" || run.status === "failed") &&
    Date.parse(run.created_at) >= now - 24 * 60 * 60 * 1000)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
