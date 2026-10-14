import { describe, expect, it } from "vitest";
import { deleteConfirmed, hiddenField, hideConfirmed } from "./comment-moderation";

describe("Meta moderation read-back", () => {
  it("uses is_hidden on Facebook and hidden on Instagram", () => {
    expect(hiddenField("facebook")).toBe("is_hidden");
    expect(hiddenField("instagram")).toBe("hidden");
  });
  it("only reports hidden when Meta shows the comment as hidden", () => {
    expect(hideConfirmed("facebook", { id: "1", is_hidden: true }, true)).toBe(true);
    expect(hideConfirmed("facebook", { id: "1", is_hidden: false }, true)).toBe(false);
    expect(hideConfirmed("facebook", { error: { code: 10 } }, true)).toBe(false);
  });
  it("only reports deleted when the comment can no longer be read", () => {
    expect(deleteConfirmed({ error: { code: 100 } })).toBe(true);
    expect(deleteConfirmed({ id: "123_456" })).toBe(false);
  });
});
