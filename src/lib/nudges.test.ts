import { describe, expect, it } from "vitest";

import { conversationNudgeDue } from "@/lib/nudges";

const now = new Date("2026-10-03T12:00:00Z");
const ago = (mins: number) => new Date(now.getTime() - mins * 60_000).toISOString();

describe("conversationNudgeDue", () => {
  it("nudges when the last inbound is older than the delay and unanswered", () => {
    expect(conversationNudgeDue(ago(180), null, 120, now)).toBe(true);
  });

  it("waits when the contact replied recently", () => {
    expect(conversationNudgeDue(ago(30), null, 120, now)).toBe(false);
  });

  it("never nudges outside Meta's 24h window", () => {
    expect(conversationNudgeDue(ago(24 * 60), null, 120, now)).toBe(false);
    expect(conversationNudgeDue(ago(23 * 60 + 30), null, 120, now)).toBe(false);
  });

  it("stays quiet when we already replied after their last message", () => {
    expect(conversationNudgeDue(ago(180), ago(60), 120, now)).toBe(false);
  });

  it("nudges when our last reply was before their latest message", () => {
    expect(conversationNudgeDue(ago(180), ago(240), 120, now)).toBe(true);
  });

  it("rejects invalid timestamps", () => {
    expect(conversationNudgeDue("not-a-date", null, 120, now)).toBe(false);
  });
});
