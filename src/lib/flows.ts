/**
 * Phase B flow model + pure evaluator. Client-safe (no server imports).
 * Flows are "advanced mode"; existing keyword rules stay "simple mode" and
 * are never read or changed by this module.
 */
export type FlowTrigger = "new_comment" | "new_dm" | "story_reply" | "story_mention";

/** Every step can be switched off (`disabled: true`); switched-off steps are skipped, never run. */
export type CanvasPos = { x: number; y: number };
/** `pos` is only where the card sits on the canvas; it never changes how the flow runs. */
type StepBase = { id: string; disabled?: boolean; pos?: CanvasPos };
export function sanitizePos(v: unknown): CanvasPos | undefined {
  const p = v as { x?: unknown; y?: unknown } | null;
  if (!p || typeof p !== "object") return undefined;
  const x = Number(p.x), y = Number(p.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  const c = (n: number) => Math.round(Math.min(20000, Math.max(-5000, n)));
  return { x: c(x), y: c(y) };
}
export type ContactCheck = "email" | "phone" | "any" | "none";
export type FlowStep = StepBase & (
  | { kind: "condition"; check: "contains"; value: string }
  | { kind: "condition"; check: "not_contains"; value: string }
  | { kind: "condition"; check: "is_follower"; value: "yes" | "no" }
  | { kind: "condition"; check: "has_tag"; value: string }
  | { kind: "condition"; check: "no_tag"; value: string }
  | { kind: "condition"; check: "has_contact"; value: ContactCheck }
  | { kind: "send_dm"; text: string; buttonTitle?: string; buttonUrl?: string }
  | { kind: "public_reply"; text: string }
  | { kind: "wait"; minutes: number }
  | { kind: "tag"; value: string }
  | { kind: "remove_tag"; value: string }
  | { kind: "ask_contact"; text: string }
  | { kind: "opening_dm"; text: string; buttonTitle: string }
  | { kind: "follow_gate"; text: string; buttonTitle: string; profileUrl: string }
  | { kind: "send_payment"; productId: string; text: string }
  | { kind: "send_offer"; productId: string; pageId: string; text: string }
  | { kind: "send_coupon"; campaignId: string; text: string }
  | { kind: "lead_form"; intro: string; fields: LeadField[] }
);

/** One question in a lead form. `choice` fields show their options as tap buttons. */
export type LeadField = { key: string; label: string; type: "text" | "email" | "phone" | "choice"; options: string[] };
export const MAX_LEAD_FIELDS = 6;
export const MAX_LEAD_OPTIONS = 10;

/** Check one lead-form answer. Choice answers match an option (case-insensitive) or its number. */
export function leadAnswer(f: LeadField, raw: string): { ok: true; value: string } | { ok: false; hint: string } {
  const v = raw.trim();
  if (!v) return { ok: false, hint: "Please type your answer." };
  if (f.type === "email") {
    const m = v.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    return m ? { ok: true, value: m[0].toLowerCase() } : { ok: false, hint: "That doesn't look like an email. Please try again." };
  }
  if (f.type === "phone") {
    const d = v.replace(/[^\d+]/g, "");
    return d.replace(/\D/g, "").length >= 10 ? { ok: true, value: d } : { ok: false, hint: "Please send a valid phone number (10+ digits)." };
  }
  if (f.type === "choice") {
    const n = Number(v);
    const hit = Number.isInteger(n) && n >= 1 && n <= f.options.length ? f.options[n - 1] : f.options.find((o) => o.toLowerCase() === v.toLowerCase());
    return hit ? { ok: true, value: hit } : { ok: false, hint: `Please choose one: ${f.options.join(", ")}` };
  }
  return { ok: true, value: v.slice(0, 300) };
}

/** Field key safe for Contacts custom fields. */
export const leadFieldKey = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30) || "field";

/** Popular tags offered as one-click presets (custom tags always allowed). */
export const TAG_PRESETS = [
  "hot-lead", "lead", "pricing-enquiry", "interested-buyer", "paid-customer", "vip-client", "cart-abandoned",
  "support-needed", "follower", "non-follower", "follower-exclusive", "discount-claimed", "giveaway-entry",
  "webinar-attendee", "story-engaged", "mentioned-us", "email-captured", "phone-captured", "lead-followup",
  "collab-enquiry", "repeat-customer", "do-not-contact",
];

export type Flow = {
  id: string;
  name: string;
  active: boolean;
  platform: "instagram" | "facebook" | "both";
  trigger: FlowTrigger;
  steps: FlowStep[];
  updatedAt: string;
  triggerPos?: CanvasPos | undefined;
  addPos?: CanvasPos | undefined;
  /** Comment flows only: limit to these posts/reels. Empty or missing = all posts. */
  targetPostIds?: string[] | undefined;
};

export const MAX_TARGET_POSTS = 50;

/** A comment flow with no selected posts applies to every post (same rule as keyword rules). */
export function flowTargetsPost(flow: Pick<Flow, "trigger" | "targetPostIds">, postExternalId: string | null): boolean {
  if (flow.trigger !== "new_comment") return true;
  const targets = (flow.targetPostIds ?? []).map((t) => t.trim()).filter(Boolean);
  if (targets.length === 0) return true;
  if (!postExternalId) return false;
  return targets.some((t) => t === postExternalId || postExternalId.endsWith(`_${t}`) || t.endsWith(`_${postExternalId}`));
}

export const MAX_FLOWS = 20;
export const MAX_STEPS = 25;

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
    const steps = (Array.isArray(r.steps) ? r.steps : []).slice(0, MAX_STEPS).flatMap((s): FlowStep[] =>
      sanitizeStep(s).map((st) => {
        const raw = s as { disabled?: unknown; pos?: unknown };
        const pos = sanitizePos(raw?.pos);
        return { ...st, ...(raw?.disabled === true ? { disabled: true } : {}), ...(pos ? { pos } : {}) };
      }));
    const triggerPos = sanitizePos(r.triggerPos);
    const addPos = sanitizePos(r.addPos);
    const targetPostIds = Array.isArray(r.targetPostIds)
      ? [...new Set(r.targetPostIds.map((t) => String(t ?? "").trim().slice(0, 80)).filter((t) => /^[\w.:-]+$/.test(t)))].slice(0, MAX_TARGET_POSTS)
      : [];
    return [{
      id: typeof r.id === "string" ? r.id.slice(0, 20) : id(),
      name: r.name.trim().slice(0, 80) || "Untitled flow",
      active: r.active === true,
      platform,
      trigger,
      steps,
      updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : new Date().toISOString(),
      ...(triggerPos ? { triggerPos } : {}),
      ...(addPos ? { addPos } : {}),
      ...(trigger === "new_comment" && targetPostIds.length ? { targetPostIds } : {}),
    }];
  });
}

/** Accept "instagram.com/me" or "http://…" and turn it into a https link; anything else stays as typed. */
export function normalizeUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  if (/^https:\/\//i.test(v)) return v;
  if (/^http:\/\//i.test(v)) return "https://" + v.slice(7);
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(v)) return "https://" + v;
  return v;
}

function sanitizeStep(s: unknown): FlowStep[] {
      const x = s as { id?: unknown; kind?: unknown; check?: unknown; value?: unknown; text?: unknown; buttonTitle?: unknown; buttonUrl?: unknown; minutes?: unknown };
      const sid = typeof x.id === "string" ? x.id.slice(0, 20) : id();
      const text = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
      const link = (v: unknown, n: number) => normalizeUrl(text(v, n));
      if (!x || typeof x !== "object") return [];
      switch (x.kind) {
        case "condition":
          if (x.check === "is_follower") return [{ id: sid, kind: "condition", check: "is_follower", value: x.value === "no" ? "no" : "yes" }];
          if (x.check === "has_tag" || x.check === "no_tag") return [{ id: sid, kind: "condition", check: x.check, value: text(x.value, 40) }];
          if (x.check === "has_contact") {
            const v = ["email", "phone", "any", "none"].includes(String(x.value)) ? (x.value as ContactCheck) : "any";
            return [{ id: sid, kind: "condition", check: "has_contact", value: v }];
          }
          if (x.check === "not_contains") return [{ id: sid, kind: "condition", check: "not_contains", value: text(x.value, 200) }];
          return [{ id: sid, kind: "condition", check: "contains", value: text(x.value, 200) }];
        case "send_dm": {
          const url = link(x.buttonUrl, 500);
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
        case "remove_tag":
          return [{ id: sid, kind: "remove_tag", value: text(x.value, 40) }];
        case "ask_contact":
          return [{ id: sid, kind: "ask_contact", text: text(x.text, 1000) }];
        case "opening_dm":
          return [{ id: sid, kind: "opening_dm", text: text(x.text, 640), buttonTitle: text(x.buttonTitle, 20) || "Send me the link" }];
        case "follow_gate": {
          const y = s as { profileUrl?: unknown };
          const url = link(y.profileUrl, 300);
          return [{ id: sid, kind: "follow_gate", text: text(x.text, 1000), buttonTitle: text(x.buttonTitle, 20) || "Visit profile", profileUrl: /^https:\/\//i.test(url) ? url : "" }];
        }
        case "send_payment": {
          const y = s as { productId?: unknown };
          return [{ id: sid, kind: "send_payment", productId: text(y.productId, 40), text: text(x.text, 600) }];
        }
        case "send_offer": {
          const y = s as { productId?: unknown; pageId?: unknown };
          return [{ id: sid, kind: "send_offer", productId: text(y.productId, 40), pageId: text(y.pageId, 40), text: text(x.text, 600) }];
        }
        case "send_coupon": {
          const y = s as { campaignId?: unknown };
          return [{ id: sid, kind: "send_coupon", campaignId: text(y.campaignId, 40), text: text(x.text, 600) }];
        }
        case "lead_form": {
          const y = s as { intro?: unknown; fields?: unknown };
          const fields = (Array.isArray(y.fields) ? y.fields : []).slice(0, MAX_LEAD_FIELDS).map((f): LeadField => {
            const r = (f ?? {}) as Partial<LeadField>;
            const type = (["text", "email", "phone", "choice"] as const).includes(r.type as never) ? r.type! : "text";
            const label = text(r.label, 120);
            const options = type === "choice" && Array.isArray(r.options)
              ? [...new Set(r.options.map((o) => text(o, 20)).filter(Boolean))].slice(0, MAX_LEAD_OPTIONS) : [];
            return { key: leadFieldKey(text(r.key, 30) || label), label, type, options };
          });
          return [{ id: sid, kind: "lead_form", intro: text(y.intro, 500), fields }];
        }
        default:
          return [];
      }
}

/** Problems that block activating a flow. Empty array = ready. */
export function validateFlow(flow: Flow): string[] {
  const issues: string[] = [];
  const on = flow.steps.filter((s) => !s.disabled);
  if (!on.some((s) => MESSAGE_KINDS.includes(s.kind))) {
    issues.push("Add at least one message step.");
  }
  flow.steps.forEach((s, i) => {
    if (s.disabled) return;
    if ((s.kind === "ask_contact" || s.kind === "follow_gate" || s.kind === "opening_dm") && !s.text) issues.push(`Step ${i + 1}: message is empty.`);
    if (s.kind === "opening_dm") {
      if (flow.trigger !== "new_comment") issues.push(`Step ${i + 1}: opening DM requires a comment trigger.`);
      if (!s.buttonTitle) issues.push(`Step ${i + 1}: button title is empty.`);
      if (flow.steps.slice(0, i).some((p) => !p.disabled && (["opening_dm", "send_dm", "follow_gate", "ask_contact", "lead_form", "send_payment", "send_coupon"].includes(p.kind) || (p.kind === "condition" && p.check === "is_follower")))) issues.push(`Step ${i + 1}: place opening DM before private messages and follower checks.`);
    }
    if (s.kind === "follow_gate" && !s.profileUrl) issues.push(`Step ${i + 1}: add your profile link (https://…).`);
    if (s.kind === "condition" && (s.check === "not_contains" || s.check === "has_tag" || s.check === "no_tag") && !s.value) issues.push(`Step ${i + 1}: value is empty.`);
    if ((s.kind === "tag" || s.kind === "remove_tag") && !s.value) issues.push(`Step ${i + 1}: tag is empty.`);
    if ((s.kind === "send_dm" || s.kind === "public_reply") && !s.text) issues.push(`Step ${i + 1}: message is empty.`);
    if (s.kind === "condition" && s.check === "contains" && !s.value) issues.push(`Step ${i + 1}: keyword is empty.`);
    if (s.kind === "send_payment" && !s.productId) issues.push(`Step ${i + 1}: choose a product.`);
    if (s.kind === "send_offer" && !s.productId) issues.push(`Step ${i + 1}: choose a product.`);
    if (s.kind === "send_offer" && !s.pageId) issues.push(`Step ${i + 1}: choose a delivery page.`);
    if (s.kind === "send_coupon" && !s.campaignId) issues.push(`Step ${i + 1}: choose a coupon campaign.`);
    if (s.kind === "send_coupon" && !s.text.includes("{code}")) issues.push(`Step ${i + 1}: message must include {code}.`);
    if (s.kind === "lead_form") {
      if (s.fields.length === 0) issues.push(`Step ${i + 1}: add at least one question.`);
      s.fields.forEach((f, j) => {
        if (!f.label) issues.push(`Step ${i + 1}: question ${j + 1} is empty.`);
        if (f.type === "choice" && f.options.length < 2) issues.push(`Step ${i + 1}: question ${j + 1} needs 2+ choices.`);
      });
    }
    if (s.kind === "public_reply" && flow.trigger !== "new_comment") issues.push(`Step ${i + 1}: public replies only work on comments.`);
  });
  return issues;
}

const MESSAGE_KINDS: FlowStep["kind"][] = ["send_dm", "public_reply", "send_offer", "send_payment", "send_coupon", "ask_contact", "follow_gate", "lead_form", "opening_dm"];

export type FlowInput = {
  text: string; isFollower: boolean | null; platform: "instagram" | "facebook"; trigger: FlowTrigger;
  tags?: string[]; hasEmail?: boolean; hasPhone?: boolean; openerTapped?: boolean;
};

const keywords = (v: string) => v.toLowerCase().split(",").map((k) => k.trim()).filter(Boolean);

/** Pure condition check shared by the dry run and the live runner. */
export function conditionPasses(
  s: Extract<FlowStep, { kind: "condition" }>,
  ctx: { text: string; isFollower: boolean | null; tags: string[]; hasEmail: boolean; hasPhone: boolean },
): boolean {
  const text = ctx.text.toLowerCase();
  const tag = s.value.toLowerCase();
  switch (s.check) {
    case "contains": return keywords(s.value).some((k) => text.includes(k));
    case "not_contains": return !keywords(s.value).some((k) => text.includes(k));
    case "is_follower": return ctx.isFollower === (s.value === "yes");
    case "has_tag": return ctx.tags.includes(tag);
    case "no_tag": return !ctx.tags.includes(tag);
    case "has_contact":
      if (s.value === "email") return ctx.hasEmail;
      if (s.value === "phone") return ctx.hasPhone;
      if (s.value === "none") return !ctx.hasEmail && !ctx.hasPhone;
      return ctx.hasEmail || ctx.hasPhone;
  }
}
export type FlowOutcome = { kind: string; detail: string };

/** Dry-run a flow. Conditions that fail stop the flow; nothing is sent. */
export function runFlowDry(flow: Flow, input: FlowInput): { matched: boolean; actions: FlowOutcome[]; stoppedAt: number | null } {
  if (flow.trigger !== input.trigger) return { matched: false, actions: [], stoppedAt: null };
  if (flow.platform !== "both" && flow.platform !== input.platform) return { matched: false, actions: [], stoppedAt: null };
  const actions: FlowOutcome[] = [];
  const tags = new Set((input.tags ?? []).map((t) => t.toLowerCase()));
  for (let i = 0; i < flow.steps.length; i++) {
    const s = flow.steps[i]!;
    if (s.disabled) continue;
    if (s.kind === "condition") {
      const ok = conditionPasses(s, { text: input.text, isFollower: input.isFollower, tags: [...tags], hasEmail: !!input.hasEmail, hasPhone: !!input.hasPhone });
      if (!ok) return { matched: true, actions, stoppedAt: i };
      continue;
    }
    if (s.kind === "opening_dm") {
      actions.push({ kind: "Opening DM", detail: `${s.text} [${s.buttonTitle}]` });
      if (!input.openerTapped) return { matched: true, actions, stoppedAt: i };
      actions.push({ kind: "Button tap received", detail: "Continue from the original comment after the tap." });
    }
    if (s.kind === "follow_gate") {
      if (input.isFollower === true) continue;
      actions.push({ kind: "Follow request DM", detail: `${s.text} [${s.buttonTitle}] [I followed ✅]` });
      return { matched: true, actions, stoppedAt: i };
    }
    if (s.kind === "send_dm") actions.push({ kind: "DM", detail: s.text + (s.buttonTitle ? ` [${s.buttonTitle}]` : "") });
    if (s.kind === "public_reply") actions.push({ kind: "Public reply", detail: s.text });
    if (s.kind === "wait") actions.push({ kind: "Wait", detail: `${s.minutes} min` });
    if (s.kind === "tag") { tags.add(s.value.toLowerCase()); actions.push({ kind: "Tag", detail: s.value }); }
    if (s.kind === "remove_tag") { tags.delete(s.value.toLowerCase()); actions.push({ kind: "Remove tag", detail: s.value }); }
    if (s.kind === "ask_contact") actions.push({ kind: "Ask email / phone DM", detail: s.text });
    if (s.kind === "send_payment") actions.push({ kind: "Payment link DM", detail: (s.text || "Pay here") + " [Pay now]" });
    if (s.kind === "send_offer") actions.push({ kind: "Offer page DM", detail: (s.text || "See your offer") + " [View offer]" });
    if (s.kind === "lead_form") {
      actions.push({ kind: "Lead form", detail: s.fields.map((f, j) => `${j + 1}. ${f.label}${f.type === "choice" ? ` [${f.options.join(" / ")}]` : ""}`).join("  ") });
      continue; // live: waits for each answer, then continues
    }
    if (s.kind === "send_coupon") actions.push({ kind: "Coupon DM", detail: s.text.replace("{code}", "ABC-1234") });
  }
  return { matched: true, actions, stoppedAt: null };
}

/** Map an incoming event to the flow trigger it starts. */
export function flowTriggerFor(channel: string, trigger?: string): FlowTrigger {
  if (trigger === "story_reply" || trigger === "story_mention") return trigger;
  return channel === "comment" ? "new_comment" : "new_dm";
}

/** Move one step from index `from` to index `to` (drag and drop). */
export function moveStep<T>(steps: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= steps.length || to < 0 || to >= steps.length) return steps;
  const arr = [...steps];
  const [s] = arr.splice(from, 1);
  arr.splice(to, 0, s!);
  return arr;
}
