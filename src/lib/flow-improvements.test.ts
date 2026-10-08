import { describe, expect, it } from "vitest";
import { callbackMatches, flowCallbackPayload, parseFlowCallback } from "@/lib/flow-callback";
import { zoomAt, wheelPixels } from "@/lib/canvas-view";
import { activitySource, activityName, stepLabel } from "@/lib/activity-explain";
import { runFlowDry, sanitizeFlows, validateFlow, type Flow } from "@/lib/flows";
import { FLOW_TEMPLATES, flowFromTemplate } from "@/lib/flow-templates";

const callback = { runId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", stage: "opener" as const, nonce: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" };
const saved = { organizationId: "org", socialAccountId: "account", platform: "instagram", externalUserId: "recipient" };
const pending = { ...callback, stepId: "opening" };
const flow: Flow = { id: "flow", name: "Sales", active: true, platform: "instagram", trigger: "new_comment", updatedAt: "", steps: [
  { id: "opening", kind: "opening_dm", text: "Tap below", buttonTitle: "Send me the link" },
  { id: "gate", kind: "follow_gate", text: "Follow first", buttonTitle: "Visit profile", profileUrl: "https://instagram.com/shop" },
  { id: "dm", kind: "send_dm", text: "Your link", buttonTitle: "", buttonUrl: "" },
] };
const input = { text: "link", platform: "instagram" as const, trigger: "new_comment" as const, isFollower: true };

describe("flow-owned callbacks", () => {
  it("round trips run, stage and nonce", () => expect(parseFlowCallback(flowCallbackPayload(callback))).toEqual(callback));
  it("never accepts rule, legacy, malformed or arbitrary message payloads", () => {
    for (const payload of [null, "FLOW_FOLLOWED", "AUTOMATION_FOLLOW_CHECK:test", "Send me the link", "FLOW_TAP:bad:opener:bad", flowCallbackPayload(callback) + ":extra"]) expect(parseFlowCallback(payload)).toBeNull();
  });
  it("matches only the pending stage and step for the original recipient", () => expect(callbackMatches(callback, pending, saved, saved, "opening")).toBe(true));
  it.each(["organizationId", "socialAccountId", "platform", "externalUserId"] as const)("rejects mismatched %s", (key) => expect(callbackMatches(callback, pending, saved, { ...saved, [key]: "other" }, "opening")).toBe(false));
  it("rejects wrong nonce, stage and edited step", () => {
    expect(callbackMatches({ ...callback, nonce: "other" }, pending, saved, saved, "opening")).toBe(false);
    expect(callbackMatches({ ...callback, stage: "follow" }, pending, saved, saved, "opening")).toBe(false);
    expect(callbackMatches(callback, pending, saved, saved, "changed")).toBe(false);
  });
});

describe("comment opt-in sequence", () => {
  it("followers also wait for the opener tap before receiving a link", () => {
    const result = runFlowDry(flow, input);
    expect(result.stoppedAt).toBe(0);
    expect(result.actions.map((a) => a.kind)).toEqual(["Opening DM"]);
  });
  it("verified followers continue after the opener tap", () => expect(runFlowDry(flow, { ...input, openerTapped: true }).actions.at(-1)?.detail).toBe("Your link"));
  it("unverified followers receive the follow gate, never the link", () => {
    for (const isFollower of [false, null]) {
      const r = runFlowDry(flow, { ...input, openerTapped: true, isFollower });
      expect(r.stoppedAt).toBe(1);
      expect(r.actions.some((a) => a.detail === "Your link")).toBe(false);
      expect(r.actions.at(-1)?.detail).toContain("[Visit profile] [I followed ✅]");
    }
  });
  it("validates opener ordering and comment-only use", () => {
    expect(validateFlow(flow)).toEqual([]);
    expect(validateFlow({ ...flow, trigger: "new_dm" }).join()).toContain("comment trigger");
    expect(validateFlow({ ...flow, steps: [flow.steps[1]!, flow.steps[0]!] }).join()).toContain("before private messages");
  });
  it("preserves disabled openers and never rewrites existing saved flows", () => {
    expect(sanitizeFlows([{ ...flow, steps: [{ ...flow.steps[0], disabled: true }, flow.steps[2]] }])[0]?.steps[0]?.disabled).toBe(true);
    expect(sanitizeFlows([{ ...flow, steps: [flow.steps[2]] }])[0]?.steps).toHaveLength(1);
  });
  it("comment DM templates include exactly one opener before follower checks", () => {
    for (const template of FLOW_TEMPLATES.filter((t) => t.trigger === "new_comment")) {
      const f = flowFromTemplate(template.key);
      expect(f).not.toBeNull();
      if (!f) throw new Error("Missing template");
      const opening = f.steps.findIndex((s) => s.kind === "opening_dm");
      if (!f.steps.some((s) => ["send_dm", "follow_gate", "ask_contact", "send_payment", "send_coupon", "lead_form"].includes(s.kind))) continue;
      expect(opening).toBeGreaterThanOrEqual(0);
      expect(f.steps.filter((s) => s.kind === "opening_dm")).toHaveLength(1);
      expect(f.steps.slice(0, opening).some((s) => s.kind === "follow_gate" || s.kind === "condition" && s.check === "is_follower")).toBe(false);
    }
  });
  it("builds the all-in-one as a safe qualification-to-sale funnel", () => {
    const all = flowFromTemplate("all_in_one");
    expect(all).not.toBeNull();
    if (!all) throw new Error("Missing all-in-one template");
    expect(all.steps.filter((s) => s.kind === "opening_dm")).toHaveLength(1);
    expect(all.steps.findIndex((s) => s.kind === "lead_form")).toBeGreaterThan(all.steps.findIndex((s) => s.kind === "follow_gate"));
    const offer = all.steps.find((s) => s.kind === "send_offer");
    expect(offer?.disabled).toBe(true);
    expect(all.steps.find((s) => s.kind === "send_payment")?.disabled).toBe(true);
    expect(all.steps.find((s) => s.kind === "send_coupon")?.disabled).toBe(true);
    expect(all.steps.some((s) => s.kind === "condition" && s.check === "no_tag" && s.value === "paid-customer")).toBe(true);
  });
});

describe("source labels and canvas view", () => {
  it("does not classify null-rule system events as flows", () => {
    expect(activitySource({ rule_id: null, detail: "gate_tap_received" })).toBe("system");
    expect(activitySource({ rule_id: "rule", detail: null })).toBe("rules");
    expect(activitySource({ rule_id: null, detail: "flow:Sales:opening_dm" })).toBe("flows");
    expect(activityName({ rule_id: null, detail: "flow:Sales:opening_dm" }, () => "Rule")).toBe("Sales");
    expect(stepLabel("flow:Sales:opening_dm")).toBe("Send me the link button sent");
  });
  it("keeps the point under the pointer fixed when zooming", () => {
    const pan = { x: -200, y: 30 }, anchor = { x: 480, y: 280 };
    const r = zoomAt(pan, 0.8, 1.2, anchor);
    expect((anchor.x - r.pan.x) / r.zoom).toBeCloseTo((anchor.x - pan.x) / 0.8);
    expect((anchor.y - r.pan.y) / r.zoom).toBeCloseTo((anchor.y - pan.y) / 0.8);
    expect(zoomAt(pan, 1, 9, anchor).zoom).toBe(1.5);
    expect(zoomAt(pan, 1, 0.01, anchor).zoom).toBe(0.4);
  });
  it("normalizes pixel, line and page wheel deltas", () => {
    expect(wheelPixels(2, 0, 800)).toBe(2);
    expect(wheelPixels(2, 1, 800)).toBe(32);
    expect(wheelPixels(2, 2, 800)).toBe(1600);
  });
});