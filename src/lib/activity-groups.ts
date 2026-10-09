import type { AutomationRun } from "@/lib/automations.functions";

export type RunGroup = {
  key: string;
  steps: AutomationRun[]; // oldest first
  status: "completed" | "in_progress" | "skipped" | "failed";
  sent: number;
  startedAt: string;
};

/** Groups activity rows into one entry per automation run (rows without a run key stay single). Newest run first. */
export function groupRuns(rows: AutomationRun[]): RunGroup[] {
  const map = new Map<string, AutomationRun[]>();
  for (const r of rows) {
    const k = r.run_key || `row:${r.id}`;
    const list = map.get(k);
    if (list) list.push(r); else map.set(k, [r]);
  }
  const groups = [...map.entries()].map(([key, list]): RunGroup => {
    const steps = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const last = steps[steps.length - 1]!;
    const sent = steps.filter((s) => s.status === "sent").length;
    const waiting = /waiting_|form_|_tap_received|pending/.test(last.detail ?? "") && last.status === "matched";
    const status: RunGroup["status"] = steps.some((s) => s.status === "failed") ? "failed"
      : waiting ? "in_progress" : sent > 0 || last.status === "matched" ? "completed" : "skipped";
    return { key, steps, status, sent, startedAt: steps[0]!.created_at };
  });
  return groups.sort((a, b) => b.steps[b.steps.length - 1]!.created_at.localeCompare(a.steps[a.steps.length - 1]!.created_at));
}
