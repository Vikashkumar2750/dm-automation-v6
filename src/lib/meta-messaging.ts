/** Normalize Instagram button taps, including postbacks without a visible title. */
export type MetaMessagingEvent = {
  timestamp?: number;
  message?: { mid?: string; text?: string; is_echo?: boolean; quick_reply?: { payload?: string } };
  postback?: { mid?: string; payload?: string; title?: string };
  sender?: { id?: string };
  recipient?: { id?: string };
};

/**
 * Meta delivers Instagram taps in two shapes: directly in `entry.messaging`
 * and nested below `entry.changes[].value`. Normalize both, including the
 * scalar sender/recipient ids used by some Instagram webhook versions.
 */
export function normalizeMessagingEvent(value: unknown): MetaMessagingEvent {
  const outer = value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
  const nested = outer["value"] && typeof outer["value"] === "object"
    ? outer["value"] as Record<string, unknown>
    : null;
  const raw = nested && (
    nested["message"] || nested["postback"] || nested["sender"] || nested["sender_id"]
  )
    ? nested
    : outer;
  const senderId = typeof raw["sender_id"] === "string" ? raw["sender_id"] : undefined;
  const recipientId = typeof raw["recipient_id"] === "string" ? raw["recipient_id"] : undefined;
  const event = raw as MetaMessagingEvent;
  const normalized: MetaMessagingEvent = { ...event };
  if (!normalized.sender && senderId) normalized.sender = { id: senderId };
  if (!normalized.recipient && recipientId) normalized.recipient = { id: recipientId };
  return normalized;
}

export function isMessagingEventType(type: string) {
  return ["message", "messages", "messaging_postbacks", "standby"]
    .some((field) => type.endsWith(`.${field}`));
}

export function messagingContent(event: MetaMessagingEvent) {
  const payload = event.message?.quick_reply?.payload ?? event.postback?.payload ?? null;
  const body = event.message?.text || event.postback?.title ||
    (payload ? "[button tap]" : null);
  const externalId = event.postback
    ? `postback:${event.postback.mid ?? event.postback.payload ?? "unknown"}:${event.timestamp ?? "untimed"}`
    : (event.message?.mid ?? null);
  return { payload, body, externalId };
}

export function followGateId(payload: string | null | undefined) {
  const prefix = "AUTOMATION_FOLLOW_CHECK:";
  if (!payload?.startsWith(prefix)) return null;
  const id = payload.slice(prefix.length).split(":", 1)[0]?.trim();
  return id || null;
}