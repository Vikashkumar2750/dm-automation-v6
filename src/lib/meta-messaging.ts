/** Normalize Instagram button taps, including postbacks without a visible title. */
export type MetaMessagingEvent = {
  timestamp?: number;
  message?: { mid?: string; text?: string; is_echo?: boolean; quick_reply?: { payload?: string } };
  postback?: { mid?: string; payload?: string; title?: string };
};

export function messagingContent(event: MetaMessagingEvent) {
  const payload = event.message?.quick_reply?.payload ?? event.postback?.payload ?? null;
  const body = event.message?.text || event.postback?.title ||
    (payload ? "[button tap]" : null);
  const externalId = event.postback
    ? `postback:${event.postback.mid ?? event.postback.payload ?? "unknown"}:${event.timestamp ?? "untimed"}`
    : (event.message?.mid ?? null);
  return { payload, body, externalId };
}