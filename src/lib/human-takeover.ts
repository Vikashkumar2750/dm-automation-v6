// P2 human takeover — pure helpers (browser + server safe).
// Lifecycle: BOT_ACTIVE → HUMAN_TAKEOVER (bot paused until expiry) → bot eligible again.

export const DEFAULT_TAKEOVER_MINUTES = 60;
export const MIN_TAKEOVER_MINUTES = 5;
export const MAX_TAKEOVER_MINUTES = 10080; // 7 days

export function clampTakeoverMinutes(raw: unknown): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_TAKEOVER_MINUTES;
  return Math.min(MAX_TAKEOVER_MINUTES, Math.max(MIN_TAKEOVER_MINUTES, n));
}

export function takeoverUntil(now: Date, minutes: unknown): string {
  return new Date(now.getTime() + clampTakeoverMinutes(minutes) * 60_000).toISOString();
}

/** True while the conversation is owned by a human. Expiry restores eligibility automatically. */
export function takeoverActive(conv: { bot_paused_until?: string | null } | null | undefined, now = new Date()): boolean {
  const until = conv?.bot_paused_until;
  return Boolean(until && new Date(until).getTime() > now.getTime());
}

/**
 * Only a genuine manual team-member outbound message starts takeover:
 * outbound + a signed-in team member as sender. Inbound, rule, flow, AI,
 * nudge, payment and system messages carry no sent_by and never qualify.
 */
export function startsTakeover(msg: { direction: string; sent_by?: string | null }): boolean {
  return msg.direction === "outbound" && typeof msg.sent_by === "string" && msg.sent_by.length > 0;
}
