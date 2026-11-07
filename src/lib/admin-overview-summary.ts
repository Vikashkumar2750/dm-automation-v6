/** Unsigned callback probes stay audited, but are not confirmed delivery failures. */
export function summarizeIncomingEvents(events: { signature_valid: boolean; status: string }[]) {
  return {
    deliveryFailures: events.filter((event) => event.signature_valid && event.status === "failed").length,
    rejectedProbes: events.filter((event) => !event.signature_valid).length,
  };
}