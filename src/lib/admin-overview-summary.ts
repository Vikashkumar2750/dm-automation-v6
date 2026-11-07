/** Unsigned callback probes stay audited, but are not confirmed delivery failures. */
export function summarizeIncomingEvents(events: { signature_valid: boolean; status: string }[]) {
  return {
    deliveryFailures: events.filter((event) => event.signature_valid && event.status === "failed").length,
    rejectedProbes: events.filter((event) => !event.signature_valid).length,
  };
}

/** Only finalized, signature-verified outcomes measure delivery processing. */
export function incomingProcessingRate(events: { signature_valid: boolean; status: string }[]) {
  const verified = events.filter((event) => event.signature_valid);
  const processed = verified.filter((event) => event.status === "processed").length;
  const failed = verified.filter((event) => event.status === "failed").length;
  const completed = processed + failed;
  return { processed, failed, pending: verified.length - completed, completed, rate: completed ? Math.round(processed / completed * 100) : null };
}

export function alertFeedState(hasData: boolean, isLoading: boolean, hasError: boolean, total: number, visible: number) {
  if (!hasData) return isLoading ? "loading" : "unavailable";
  if (visible > 0) return "items";
  if (hasError) return "stale";
  return total === 0 ? "empty" : "filtered";
}