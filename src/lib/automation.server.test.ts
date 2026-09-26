import { describe, expect, it } from "vitest";
import {
  followGatePayload,
  followGateStage,
  followGateVerdict,
  followVerdict,
  gateButtonMessages,
  usesPerContactDailyLimit,
} from "./automation.server";
import { followGateId } from "./meta-messaging";

describe("Facebook honor-system follow gate", () => {
  it("reads the stage from the button payload", () => {
    expect(followGateStage("AUTOMATION_FOLLOW_CHECK:g:opener:n")).toBe("opener");
    expect(followGateStage("AUTOMATION_FOLLOW_CHECK:g:confirm:n")).toBe("confirm");
  });

  it("reads the stage from exact text-only taps", () => {
    expect(followGateStage(null, "I followed ✅")).toBe("confirm");
    expect(followGateStage(null, "Send me the link")).toBe("opener");
    expect(followGateStage(null, "hello")).toBe("opener");
  });

  // Facebook shows the follow prompt on the opener tap and delivers on the
  // "I followed" tap without verification (Messenger has no follow API).
  it("asks a required-follow rule for a follow on the opener tap", () => {
    const rule = { require_follow: true, follower_condition: "non_followers" as const };
    expect(followGateVerdict(rule, null, 0)).toBe("ask_follow");
    expect(followGateVerdict(rule, true, 1)).toBe("deliver");
  });

  it("delivers directly when no follow is required", () => {
    const rule = { require_follow: false, follower_condition: "any" as const };
    expect(followGateVerdict(rule, true, 0)).toBe("deliver");
  });
});

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

  it("uses the proven quick reply first for the comment opener", () => {
    const messages = gateButtonMessages("Tap below", [button]);
    expect(messages[0]).toHaveProperty("quick_replies.0.payload", button.payload);
    expect(messages[1]).toHaveProperty("attachment.payload.template_type", "button");
  });

  it("uses a quick reply first for follow confirmation", () => {
    const messages = gateButtonMessages("Confirm below", [button]);
    expect(messages[0]).toHaveProperty("quick_replies.0.payload", button.payload);
    expect(messages[1]).toHaveProperty("attachment.payload.template_type", "button");
  });
});

describe("gate payload identity", () => {
  it("separates opener and confirmation taps for the same gate", () => {
    const opener = followGatePayload("gate-1", "opener", "nonce-1");
    const confirm = followGatePayload("gate-1", "confirm", "nonce-2");
    expect(opener).not.toBe(confirm);
    expect(opener).toContain("AUTOMATION_FOLLOW_CHECK:gate-1:opener:");
    expect(confirm).toContain("AUTOMATION_FOLLOW_CHECK:gate-1:confirm:");
    expect(followGateId(opener)).toBe("gate-1");
    expect(followGateId(confirm)).toBe("gate-1");
  });
});

describe("one reply per person per post", () => {
  it("does not let the DM contact cap block a comment on a different post", () => {
    expect(usesPerContactDailyLimit("comment")).toBe(false);
  });

  it("keeps the contact cap for ordinary direct messages", () => {
    expect(usesPerContactDailyLimit("dm")).toBe(true);
  });
});

// LOCKED FLOW — do not change these expectations without re-testing on real phones.
describe("locked: opener and non-follower follow prompt shapes", () => {
  it("opener attaches the button to the bubble and keeps the quick reply", async () => {
    const { openerMessages } = await import("./automation.server");
    const [first, second, third] = openerMessages("Hi", "Send me the link", "AUTOMATION_FOLLOW_CHECK:g:opener:n");
    expect(first).toHaveProperty("attachment.payload.template_type", "button");
    expect(first).toHaveProperty("quick_replies.0.title", "Send me the link");
    expect(second).toHaveProperty("attachment.payload.buttons.0.type", "postback");
    expect(third).toHaveProperty("quick_replies.0.payload");
  });

  it("follow prompt sends attached Visit profile + I followed buttons first", () => {
    const messages = gateButtonMessages(
      "Follow us first",
      [
        { type: "web_url", url: "https://www.instagram.com/x", title: "Visit profile" },
        { type: "postback", title: "I followed ✅", payload: "AUTOMATION_FOLLOW_CHECK:g:confirm:n" },
      ],
      false,
    );
    expect(messages[0]).toHaveProperty("attachment.payload.template_type", "button");
    expect(messages[0]).toHaveProperty("attachment.payload.buttons.0.title", "Visit profile");
    expect(messages[0]).toHaveProperty("attachment.payload.buttons.1.title", "I followed ✅");
  });
});
