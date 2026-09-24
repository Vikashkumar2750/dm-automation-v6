import { describe, expect, it } from "bun:test";
import { followGateVerdict } from "./automation.server";

describe("follow confirmation gate", () => {
  const nonFollowerRule = { require_follow: true, follower_condition: "non_followers" };

  it("does not send a non-follower-only offer to an existing follower at the opener", () => {
    expect(followGateVerdict(nonFollowerRule, true, 0)).toBe("skip_follower");
  });

  it("prompts a non-follower at the opener", () => {
    expect(followGateVerdict(nonFollowerRule, false, 0)).toBe("ask_follow");
  });

  it("delivers after the same contact follows and confirms", () => {
    expect(followGateVerdict(nonFollowerRule, true, 1)).toBe("deliver");
    expect(followGateVerdict(nonFollowerRule, true, 2)).toBe("deliver");
  });

  it("does not release the message before follow is confirmed", () => {
    expect(followGateVerdict(nonFollowerRule, false, 1)).toBe("ask_follow");
  });

  it("keeps ordinary follower-only checks intact", () => {
    const followerRule = { require_follow: false, follower_condition: "followers_only" };
    expect(followGateVerdict(followerRule, false, 0)).toBe("skip_not_follower");
    expect(followGateVerdict(followerRule, true, 0)).toBe("deliver");
  });
});