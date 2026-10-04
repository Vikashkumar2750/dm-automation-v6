// Phase G pure helpers (browser + server safe).
export type DeskRole = "owner" | "admin" | "manager" | "agent" | "viewer";

export const WEBHOOK_EVENTS = ["message.received", "message.sent"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/** Managers and above approve replies, manage keys and webhooks. */
export function canReview(role: DeskRole | null | undefined): boolean {
  return role === "owner" || role === "admin" || role === "manager";
}

/** Only agents are forced through the approval queue, and only when the workspace turned it on. */
export function mustRequestApproval(role: DeskRole | null | undefined, requireApproval: boolean): boolean {
  return requireApproval && role === "agent";
}

export type AssignmentFilter = "all" | "mine" | "unassigned";
export function matchesAssignment(assignedTo: string | null | undefined, filter: AssignmentFilter, me: string): boolean {
  if (filter === "mine") return assignedTo === me;
  if (filter === "unassigned") return !assignedTo;
  return true;
}

export const API_KEY_PREFIX = "adm_";
export function isApiKeyFormat(key: string): boolean {
  return /^adm_[A-Za-z0-9]{40}$/.test(key);
}

export function eventForDirection(direction: string): WebhookEvent {
  return direction === "inbound" ? "message.received" : "message.sent";
}

/** Public API pagination: default 50, max 100. */
export function clampLimit(raw: string | null): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n < 1) return 50;
  return Math.min(n, 100);
}

export type InvoiceStatus = "unpaid" | "paid" | "void";
/** Per-client billing summary: unpaid total and paid total (void ignored). */
export function summarizeInvoices(rows: { amount_inr: number | string; status: InvoiceStatus }[]) {
  let due = 0;
  let paid = 0;
  for (const r of rows) {
    const n = Number(r.amount_inr) || 0;
    if (r.status === "unpaid") due += n;
    else if (r.status === "paid") paid += n;
  }
  return { due: Math.round(due * 100) / 100, paid: Math.round(paid * 100) / 100 };
}
