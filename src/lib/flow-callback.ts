/** Flow-owned callbacks never overlap keyword-rule follow-gate payloads. */
export type FlowCallback = { runId: string; stage: "opener" | "follow"; nonce: string };
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const pattern = new RegExp(`^FLOW_TAP:(${UUID}):(opener|follow):(${UUID})$`, "i");
export function parseFlowCallback(payload: string | null | undefined): FlowCallback | null {
  const m = payload?.match(pattern);
  if (!m?.[1] || !m[3]) return null;
  return { runId: m[1], stage: m[2] === "opener" ? "opener" : "follow", nonce: m[3] };
}
export function flowCallbackPayload(c: FlowCallback): string {
  return `FLOW_TAP:${c.runId}:${c.stage}:${c.nonce}`;
}
export function callbackMatches(
  callback: FlowCallback,
  pending: { stage: string; nonce: string; stepId: string },
  saved: { organizationId: string; socialAccountId: string | null; platform: string; externalUserId: string },
  incoming: { organizationId: string; socialAccountId: string | null; platform: string; externalUserId: string },
  stepId: string,
): boolean {
  return callback.stage === pending.stage && callback.nonce === pending.nonce && pending.stepId === stepId &&
    saved.organizationId === incoming.organizationId && saved.socialAccountId === incoming.socialAccountId &&
    saved.platform === incoming.platform && saved.externalUserId === incoming.externalUserId;
}