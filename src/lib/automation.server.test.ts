import { describe, expect, it } from "vitest";
import { followGateVerdict, followVerdict, gateButtonMessages } from "./automation.server";

describe("required-follow link delivery", () => {
  const rule = { require_follow: true, follower_condition: "non_followers" };

  it("delivers directly to an existing follower on the opener tap", () => {
    expect(followGateVerdict(rule, true, 0)).toBe("deliver");
    expect(followVerdict(rule, true)).toBe("deliver");
  });

  it("asks a non-follower to follow, then delivers after confirmation", () => {
    expect(followGateVerdict(rule, false, 0)).toBe("ask_follow");
    expect(followGateVerdict(rule, true, 1)).toBe("deliver");
    expect(followGateVerdict(rule, false, 1)).toBe("ask_follow");
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
    expect(followGateVerdict(rule, null, 1)).toBe("ask_follow");
  });
});

describe("gate button delivery order", () => {
  const button = {
    type: "postback" as const,
    title: "Send me the link",
    payload: "AUTOMATION_FOLLOW_CHECK:gate-1",
  };

  it("uses a template postback first for the comment opener", () => {
    const messages = gateButtonMessages("Tap below", [button], false);
    expect(messages[0]).toHaveProperty("attachment.payload.template_type", "button");
    expect(messages[1]).toHaveProperty("quick_replies.0.payload", button.payload);
  });

  it("uses a quick reply first for follow confirmation", () => {
    const messages = gateButtonMessages("Confirm below", [button]);
    expect(messages[0]).toHaveProperty("quick_replies.0.payload", button.payload);
    expect(messages[1]).toHaveProperty("attachment.payload.template_type", "button");
  });
});
