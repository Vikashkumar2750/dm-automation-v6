/**
 * Phase B flow model + pure evaluator. Client-safe (no server imports).
 * Flows are "advanced mode"; existing keyword rules stay "simple mode" and
 * are never read or changed by this module.
 */
export type FlowTrigger = "new_comment" | "new_dm" | "story_reply" | "story_mention";

export type FlowStep =
  | { id: string; kind: "condition"; check: "contains"; value: string }
  | { id: string; kind: "condition"; check: "is_follower"; value: "yes" | "no" }
  | { id: string; kind: "send_dm"; text: string; buttonTitle?: string; buttonUrl?: string }
  | { id: string; kind: "public_reply"; text: string }
  | { id: string; kind: "wait"; minutes: number }
  | { id: string; kind: "tag"; value: string };

export type Flow = {
  id: string;
  name: string;
  active: boolean;
  platform: "instagram" | "facebook" | "both";
  trigger: FlowTrigger;
  steps: FlowStep[];
  updatedAt: string;
};

export const MAX_FLOWS = 20;
export const MAX_STEPS = 15;

export const TRIGGER_LABELS: Record<FlowTrigger, string> = {
  new_comment: "New comment",
  new_dm: "New DM",
  story_reply: "Story reply",
  story_mention: "Story mention",
};

const id = () => Math.random().toString(36).slice(2, 10);
export const newStepId = id;

export function sanitizeFlows(raw: unknown): Flow[] {
  if (!Array.isArray(raw)) return [];
  const triggers = Object.keys(TRIGGER_LABELS);
  return raw.slice(0, MAX_FLOWS).flatMap((f): Flow[] => {
    const r = f as Partial<Flow>;
    if (!r || typeof r.name !== "string") return [];
    const trigger = triggers.includes(String(r.trigger)) ? (r.trigger as FlowTrigger) : "new_comment";
    const platform = r.platform === "instagram" || r.platform === "facebook" ? r.platform : "both";
    const steps = (Array.isArray(r.steps) ? r.steps : []).slice(0, MAX_STEPS).flatMap((s): FlowStep[] => {
      const x = s as Record<string, unknown>;
      const sid = typeof x.id === "string" ? x.id.slice(0, 20) : id();
      const text = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
      switch (x.kind) {
        case "condition":
          if (x.check === "is_follower") return [{ id: sid, kind: "condition", check: "is_follower", value: x.value === "no" ? "no" : "yes" }];
          return [{ id: sid, kind: "condition", check: "contains", value: text(x.value, 200) }];
        case "send_dm": {
          const url = text(x.buttonUrl, 500);
          return [{
            id: sid, kind: "send_dm", text: text(x.text, 1000),
            ...(text(x.buttonTitle, 20) && /^https:\/\//i.test(url) ? { buttonTitle: text(x.buttonTitle, 20), buttonUrl: url } : {}),
          }];
        }
        case "public_reply":
          return [{ id: sid, kind: "public_reply", text: text(x.text, 500) }];
        case "wait":
          return [{ id: sid, kind: "wait", minutes: Math.min(1440, Math.max(1, Math.round(Number(x.minutes) || 1))) }];
        case "tag":
          return [{ id: sid, kind: "tag", value: text(x.value, 40) }];
        default:
          return [];
      }
    });
    return [{
      id: typeof r.id === "string" ? r.id.slice(0, 20) : id(),
      name: r.name.trim().slice(0, 80) || "Untitled flow",
      active: r.active === true,
      platform,
      trigger,
      steps,
      updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : new Date().toISOString(),
    }];
  });
}

/** Problems that block activating a flow. Empty array = ready. */
export function validateFlow(flow: Flow): string[] {
  const issues: string[] = [];
  if (!flow.steps.some((s) => s.kind === "send_dm" || s.kind === "public_reply")) {
    issues.push("Add at least one message step.");
  }
  flow.steps.forEach((s, i) => {
    if ((s.kind === "send_dm" || s.kind === "public_reply") && !s.text) issues.push(`Step ${i + 1}: message is empty.`);
    if (s.kind === "condition" && s.check === "contains" && !s.value) issues.push(`Step ${i + 1}: keyword is empty.`);
    if (s.kind === "public_reply" && flow.trigger !== "new_comment") issues.push(`Step ${i + 1}: public replies only work on comments.`);
  });
  return issues;
}

export type FlowInput = { text: string; isFollower: boolean | null; platform: "instagram" | "facebook"; trigger: FlowTrigger };
export type FlowOutcome = { kind: string; detail: string };

/** Dry-run a flow. Conditions that fail stop the flow; nothing is sent. */
export function runFlowDry(flow: Flow, input: FlowInput): { matched: boolean; actions: FlowOutcome[]; stoppedAt: number | null } {
  if (flow.trigger !== input.trigger) return { matched: false, actions: [], stoppedAt: null };
  if (flow.platform !== "both" && flow.platform !== input.platform) return { matched: false, actions: [], stoppedAt: null };
  const actions: FlowOutcome[] = [];
  const text = input.text.toLowerCase();
  for (let i = 0; i < flow.steps.length; i++) {
    const s = flow.steps[i]!;
    if (s.kind === "condition") {
      const ok =
        s.check === "contains"
          ? s.value.toLowerCase().split(",").map((k) => k.trim()).filter(Boolean).some((k) => text.includes(k))
          : input.isFollower === (s.value === "yes");
      if (!ok) return { matched: true, actions, stoppedAt: i };
      continue;
    }
    if (s.kind === "send_dm") actions.push({ kind: "DM", detail: s.text + (s.buttonTitle ? ` [${s.buttonTitle}]` : "") });
    if (s.kind === "public_reply") actions.push({ kind: "Public reply", detail: s.text });
    if (s.kind === "wait") actions.push({ kind: "Wait", detail: `${s.minutes} min` });
    if (s.kind === "tag") actions.push({ kind: "Tag", detail: s.value });
  }
  return { matched: true, actions, stoppedAt: null };
}
