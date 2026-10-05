// P2 YouTube quota backoff — pure helpers. Only used by the isolated YouTube poller.
export const QUOTA_REASONS = new Set(["quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded", "userRateLimitExceeded"]);
export const BASE_BACKOFF_MS = 30 * 60_000;
export const MAX_BACKOFF_MS = 24 * 3600_000;

export function isQuotaReason(reason: string | null | undefined): boolean {
  return Boolean(reason && QUOTA_REASONS.has(reason));
}

/** Exponential backoff: 30m, 1h, 2h … capped at 24h. streak = previous consecutive quota hits. */
export function quotaBackoffUntil(now: number, streak: number): number {
  const s = Math.max(0, Math.min(10, Math.floor(streak || 0)));
  return now + Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** s);
}

export function inQuotaBackoff(meta: Record<string, unknown> | null | undefined, now: number): boolean {
  const until = Number(meta?.["youtube_quota_until"] ?? 0);
  return Number.isFinite(until) && until > now;
}
