import type { AutomationRun } from "@/lib/automations.functions";
export { activitySource as notificationSource } from "@/lib/activity-explain";

export function notificationStorageKey(userId: string, orgId: string) {
  return `autodm.notifications.read:${userId}:${orgId}`;
}

/** Every skipped/failed step is actionable, even when another step in its run sent. */
export function notificationRuns(runs: AutomationRun[], now: number) {
  return runs.filter((run) => (run.status === "skipped" || run.status === "failed") &&
    Date.parse(run.created_at) >= now - 24 * 60 * 60 * 1000)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
