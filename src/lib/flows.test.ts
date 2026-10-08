import { describe, expect, it } from "vitest";
import { runFlowDry, sanitizeFlows, validateFlow, type Flow } from "./flows";

const base: Flow = {
  id: "f1", name: "Price flow", active: true, platform: "both", trigger: "new_comment", updatedAt: "",
  steps: [
    { id: "a", kind: "condition", check: "contains", value: "price, cost" },
    { id: "b", kind: "public_reply", text: "Sent you a DM" },
    { id: "c", kind: "send_dm", text: "Here is the price" },
  ],
};

describe("flows", () => {
  it("runs actions when keyword matches", () => {
    const r = runFlowDry(base, { text: "What is the PRICE?", isFollower: null, platform: "instagram", trigger: "new_comment" });
    expect(r.actions.map((a) => a.kind)).toEqual(["Public reply", "DM"]);
  });
  it("stops at failed condition", () => {
    const r = runFlowDry(base, { text: "nice", isFollower: null, platform: "instagram", trigger: "new_comment" });
    expect(r.stoppedAt).toBe(0);
    expect(r.actions).toHaveLength(0);
  });
  it("ignores other triggers", () => {
    expect(runFlowDry(base, { text: "price", isFollower: null, platform: "facebook", trigger: "new_dm" }).matched).toBe(false);
  });
  it("sanitizes junk and drops http buttons", () => {
    const f = sanitizeFlows([{ name: "x", steps: [{ kind: "send_dm", text: "hi", buttonTitle: "Go", buttonUrl: "http://x" }, { kind: "evil" }] }])[0]!;
    expect(f.steps).toHaveLength(1);
    expect(f.steps[0]).not.toHaveProperty("buttonUrl");
    expect(f.active).toBe(false);
  });
  it("blocks public reply on DM trigger", () => {
    expect(validateFlow({ ...base, trigger: "new_dm" }).length).toBeGreaterThan(0);
    expect(validateFlow(base)).toEqual([]);
  });
});

import { flowTriggerFor, moveStep } from "./flows";
import { liveFlowsActive } from "./flows-runner.server";
describe("phase B live helpers", () => {
  it("maps events to triggers", () => {
    expect(flowTriggerFor("comment")).toBe("new_comment");
    expect(flowTriggerFor("dm")).toBe("new_dm");
    expect(flowTriggerFor("dm", "story_reply")).toBe("story_reply");
  });
  it("moves steps for drag and drop", () => {
    expect(moveStep([1, 2, 3], 0, 2)).toEqual([2, 3, 1]);
    expect(moveStep([1, 2, 3], 2, 0)).toEqual([3, 1, 2]);
    expect(moveStep([1, 2], 0, 5)).toEqual([1, 2]);
  });
  it("live sending is on by default, off when either switch is off", () => {
    const org = "00000000-0000-0000-0000-000000000001";
    expect(liveFlowsActive({}, org)).toBe(true);
    expect(liveFlowsActive({ flows_live_enabled: false }, org)).toBe(false);
    expect(liveFlowsActive({ flows_enabled: false }, org)).toBe(false);
    expect(liveFlowsActive({ flows_enabled: true, flows_live_enabled: true, flows_live_orgs: ["x"] }, org)).toBe(false);
  });
});

import { FLOW_TEMPLATES, flowFromTemplate } from "./flow-templates";
describe("advanced flow steps", () => {
  const mk = (steps: Flow["steps"]): Flow => ({ ...base, steps });
  it("skips switched-off steps", () => {
    const f = mk([
      { id: "a", kind: "condition", check: "contains", value: "zzz", disabled: true },
      { id: "b", kind: "send_dm", text: "hi" },
      { id: "c", kind: "send_dm", text: "off", disabled: true },
    ]);
    const r = runFlowDry(f, { text: "hello", isFollower: null, platform: "instagram", trigger: "new_comment" });
    expect(r.actions.map((a) => a.detail)).toEqual(["hi"]);
    expect(sanitizeFlows([f])[0]!.steps[0]!.disabled).toBe(true);
  });
  it("follow gate stops non-followers and passes followers", () => {
    const f = mk([
      { id: "g", kind: "follow_gate", text: "Follow first", buttonTitle: "Visit profile", profileUrl: "https://instagram.com/x" },
      { id: "d", kind: "send_dm", text: "link" },
    ]);
    const no = runFlowDry(f, { text: "x", isFollower: false, platform: "instagram", trigger: "new_comment" });
    expect(no.stoppedAt).toBe(0);
    expect(no.actions[0]!.kind).toBe("Follow request DM");
    const yes = runFlowDry(f, { text: "x", isFollower: true, platform: "instagram", trigger: "new_comment" });
    expect(yes.actions.map((a) => a.detail)).toEqual(["link"]);
  });
  it("tag and contact conditions", () => {
    const f = mk([
      { id: "a", kind: "condition", check: "no_tag", value: "discount-claimed" },
      { id: "b", kind: "condition", check: "has_contact", value: "none" },
      { id: "c", kind: "ask_contact", text: "email?" },
    ]);
    const input = { text: "x", isFollower: null, platform: "instagram" as const, trigger: "new_comment" as const };
    expect(runFlowDry(f, input).actions).toHaveLength(1);
    expect(runFlowDry(f, { ...input, tags: ["discount-claimed"] }).stoppedAt).toBe(0);
    expect(runFlowDry(f, { ...input, hasEmail: true }).stoppedAt).toBe(1);
  });
  it("follow gate needs an https profile link", () => {
    const f = mk([{ id: "g", kind: "follow_gate", text: "Follow", buttonTitle: "Visit", profileUrl: "http://x" }]);
    expect(validateFlow(sanitizeFlows([f])[0]!).length).toBeGreaterThan(0);
  });
  it("every template has a category and survives sanitizing", () => {
    for (const t of FLOW_TEMPLATES) {
      expect(t.category).toBeTruthy();
      const f = flowFromTemplate(t.key)!;
      expect(sanitizeFlows([f])[0]!.steps).toHaveLength(t.steps.length);
    }
    expect(flowFromTemplate("all_in_one")!.steps.some((s) => s.disabled)).toBe(true);
  });
});

import { leadAnswer } from "./flows";
describe("lead form", () => {
  const choice = { key: "size", label: "Size?", type: "choice" as const, options: ["Small", "Large"] };
  it("checks answers by type", () => {
    expect(leadAnswer(choice, "large")).toEqual({ ok: true, value: "Large" });
    expect(leadAnswer(choice, "2")).toEqual({ ok: true, value: "Large" });
    expect(leadAnswer(choice, "medium").ok).toBe(false);
    expect(leadAnswer({ ...choice, type: "email", options: [] }, "me: A@b.co").ok).toBe(true);
    expect(leadAnswer({ ...choice, type: "phone", options: [] }, "98765").ok).toBe(false);
  });
  it("choice questions need two options", () => {
    const f: Flow = { ...base, steps: [{ id: "l", kind: "lead_form", intro: "", fields: [{ ...choice, options: ["Only"] }] }] };
    expect(validateFlow(sanitizeFlows([f])[0]!).some((x) => x.includes("2+ choices"))).toBe(true);
  });
});

import { sanitizeFlows as _sf } from "./flows";
describe("canvas positions", () => {
  it("keeps card positions and clamps bad values", () => {
    const [f] = _sf([{ name: "x", triggerPos: { x: 10, y: 20 }, steps: [{ id: "a", kind: "wait", minutes: 5, pos: { x: 99999, y: "nope" } }, { id: "b", kind: "wait", minutes: 5, pos: { x: 300, y: 40 } }] }]);
    expect(f!.triggerPos).toEqual({ x: 10, y: 20 });
    expect(f!.steps[0]!.pos).toBeUndefined();
    expect(f!.steps[1]!.pos).toEqual({ x: 300, y: 40 });
  });
});
