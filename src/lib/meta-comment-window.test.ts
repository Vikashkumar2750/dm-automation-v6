import { describe, expect, it } from "vitest";
import { withinPrivateReplyWindow } from "./meta-comment-window";

const NOW = Date.parse("2026-10-05T00:00:00Z");

describe("7-day private reply window", () => {
  it("allows a 6-day-old comment", () => {
    expect(withinPrivateReplyWindow("2026-09-29T00:00:00Z", NOW)).toBe(true);
  });
  it("blocks an 8-day-old comment", () => {
    expect(withinPrivateReplyWindow("2026-09-27T00:00:00Z", NOW)).toBe(false);
  });
  it("handles unix seconds", () => {
    expect(withinPrivateReplyWindow(NOW / 1000 - 8 * 86400, NOW)).toBe(false);
  });
  it("allows when time is unknown", () => {
    expect(withinPrivateReplyWindow(undefined, NOW)).toBe(true);
  });
});
