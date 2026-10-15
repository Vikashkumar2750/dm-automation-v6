import { describe, expect, it } from "vitest";
import { calendarPosts } from "./calendar-posts";
import type { RemotePostItem } from "./automations.functions";

const remote: RemotePostItem = { id: "a:post", externalPostId: "post", socialAccountId: "a", platform: "instagram", accountName: "A", mediaType: "REELS", caption: "Published reel", mediaUrl: null, permalink: null, publishedAt: "2026-10-15T10:00:00Z" };
describe("calendar account posts", () => {
  it("includes externally published Instagram posts with the exact connected account and date", () => {
    expect(calendarPosts([], [remote], "org")[0]).toMatchObject({ social_account_id: "a", platform: "instagram", published_at: "2026-10-15T10:00:00Z", post_format: "reel" });
  });
  it("does not duplicate a stored published post on the same account", () => {
    const stored = calendarPosts([], [remote], "org");
    expect(calendarPosts(stored, [remote], "org")).toHaveLength(1);
  });
  it("never drops another account's post with the same provider ID", () => {
    const stored = calendarPosts([], [remote], "org");
    expect(calendarPosts(stored, [{ ...remote, id: "b:post", socialAccountId: "b" }], "org").map((p) => p.social_account_id)).toEqual(["a", "b"]);
  });
});