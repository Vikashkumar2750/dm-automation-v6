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
