// P2 scheduler heartbeat — pure assessment.
export const SCHEDULER_JOBS = ["publish-due", "youtube-comments", "flows", "revenue", "nudges", "team-webhooks", "trust-guard", "encrypt-tokens"] as const;
export const TICK_MS = 60_000;
export const STALE_AFTER_MS = 5 * TICK_MS;
export const FAILURE_ALERT_STREAK = 3;
export const SLOW_TICK_MS = 45_000;

export type Heartbeat = { job: string; last_run_at: string; last_status: number | null; last_duration_ms: number | null; consecutive_failures: number };
export type JobHealth = { job: string; state: "ok" | "stale" | "failing" | "slow" | "missing"; detail: string };

export function assessJob(job: string, hb: Heartbeat | undefined, now: number): JobHealth {
  if (!hb) return { job, state: "missing", detail: "no heartbeat ever recorded" };
  const age = now - new Date(hb.last_run_at).getTime();
  if (age > STALE_AFTER_MS) return { job, state: "stale", detail: `last run ${Math.round(age / 60000)} min ago` };
  if (hb.consecutive_failures >= FAILURE_ALERT_STREAK) return { job, state: "failing", detail: `${hb.consecutive_failures} failures in a row` };
  if ((hb.last_duration_ms ?? 0) > SLOW_TICK_MS) return { job, state: "slow", detail: `${hb.last_duration_ms} ms` };
  return { job, state: "ok", detail: "" };
}

export function assessScheduler(rows: Heartbeat[], now: number) {
  const by = new Map(rows.map((r) => [r.job, r]));
  const jobs = SCHEDULER_JOBS.map((j) => assessJob(j, by.get(j), now));
  return { healthy: jobs.every((j) => j.state === "ok"), jobs };
}

export function nextFailureStreak(prev: number, ok: boolean) {
  return ok ? 0 : (prev || 0) + 1;
}
