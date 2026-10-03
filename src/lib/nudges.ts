/** Abandoned-conversation nudges: pure helpers (client-safe, unit tested). */

/**
 * A conversation is "abandoned" when the contact's last message is older than
 * the delay and we have not replied since. Nudges stay inside Meta's 24h
 * messaging window: we only nudge when the last inbound message is younger
 * than 23 hours (1h safety margin).
 */
export function conversationNudgeDue(
  lastInboundAt: string,
  lastOutboundAt: string | null,
  delayMinutes: number,
  now: Date = new Date(),
): boolean {
  const inbound = new Date(lastInboundAt).getTime();
  if (Number.isNaN(inbound)) return false;
  const ageMs = now.getTime() - inbound;
  if (ageMs < delayMinutes * 60_000) return false; // too recent — give them time
  if (ageMs > 23 * 3600_000) return false; // outside Meta's 24h window
  if (lastOutboundAt && new Date(lastOutboundAt).getTime() >= inbound) return false; // we already replied
  return true;
}
