import { describe, expect, it } from "vitest";
import { canEditComment, commentRequest } from "./comment-moderation";

describe("comment moderation rules", () => {
  it("allows editing only a Facebook Page public reply", () => {
    expect(canEditComment("facebook", "outbound", "[public reply] Thanks", "123")).toBe(true);
    expect(canEditComment("facebook", "inbound", "Thanks", "123")).toBe(false);
    expect(canEditComment("facebook", "outbound", "[private reply] Thanks", "123")).toBe(false);
  });
  it("never offers unsupported Instagram or YouTube editing", () => {
    expect(canEditComment("instagram", "outbound", "[public reply] Thanks", "123")).toBe(false);
    expect(canEditComment("youtube", "outbound", "[public reply] Thanks", "123")).toBe(false);
  });
  it("requires a real comment identifier", () => {
    expect(canEditComment("facebook", "outbound", "[public reply] Thanks", null)).toBe(false);
    expect(() => commentRequest("delete", "123/other", "test-token")).toThrow("invalid_comment_id");
  });
  it("uses native Facebook edit and actual Meta deletion, never local-only deletion", () => {
    const edit = commentRequest("edit", "123_456", "test-token", " Updated ");
    expect(edit.url).toBe("https://graph.facebook.com/v21.0/123_456");
    expect(edit.init.method).toBe("POST");
    expect(JSON.parse(edit.init.body ?? "{}")).toEqual({ message: "Updated" });
    expect(commentRequest("delete", "123_456", "test-token").init.method).toBe("DELETE");
  });
  it("rejects empty edits and edits over 1000 characters", () => {
    expect(() => commentRequest("edit", "123", "test-token", " ")).toThrow("invalid_comment_body");
    expect(() => commentRequest("edit", "123", "test-token", "a".repeat(1001))).toThrow("invalid_comment_body");
  });
});