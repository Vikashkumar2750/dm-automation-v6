import { describe, expect, it } from "vitest";
import { followGateVerdict, followVerdict } from "./automation.server";

describe("required-follow link delivery", () => {
  const rule = { require_follow: true, follower_condition: "non_followers" };

  it("delivers directly to an existing follower on the opener tap", () => {
    expect(followGateVerdict(rule, true, 0)).toBe("deliver");
    expect(followVerdict(rule, true)).toBe("deliver");
  });

  it("asks a non-follower to follow, then delivers after confirmation", () => {
    expect(followGateVerdict(rule, false, 0)).toBe("ask_follow");
    expect(followGateVerdict(rule, true, 1)).toBe("deliver");
  });

  it("does not leak a gated link when Meta cannot verify follow status", () => {
    expect(followGateVerdict(rule, null, 0)).toBe("ask_follow");
  });

  it("preserves a strict non-follower-only rule without follow requirement", () => {
    expect(followGateVerdict({ ...rule, require_follow: false }, true, 0)).toBe("skip_follower");
  });
});
describe("Everyone audience follows the plan", () => {
  const rule = { require_follow: false, follower_condition: "any" };
  it("follower gets the DM directly", () => expect(followGateVerdict(rule, true, 0)).toBe("deliver"));
  it("non-follower is asked to follow, then gets the DM", () => {
    expect(followGateVerdict(rule, false, 0)).toBe("ask_follow");
    expect(followGateVerdict(rule, true, 1)).toBe("deliver");
  });
  it("an unavailable profile cannot silently bypass the follow prompt", () => {
    expect(followGateVerdict(rule, null, 0)).toBe("ask_follow");
  });
});
