import { describe, expect, it } from "vitest";
import { messagesForPost } from "./post-comments";

const m = (id: string, direction: string, body: string, post: string | null, t: string) => ({ id, conversation_id: "c1", direction, body, post_external_id: post, sent_at: t });

describe("messagesForPost", () => {
  it("shows only this post's comments and their public replies", () => {
    const msgs = [
      m("1", "inbound", "Hifi", "PAGE_OLD", "2026-09-29"),
      m("2", "outbound", "[public reply] Check DM", null, "2026-09-29T01"),
      m("3", "inbound", "Ads", "PAGE_NEW", "2026-10-14"),
      m("4", "outbound", "[public reply] Thanks", null, "2026-10-14T01"),
      m("5", "outbound", "dm button", null, "2026-10-14T02"),
    ];
    expect(messagesForPost(msgs, "PAGE_NEW").map((x) => x.id)).toEqual(["3", "4"]);
  });
  it("matches short and full Facebook ids", () => {
    expect(messagesForPost([m("1", "inbound", "a", "NEW", "t")], "PAGE_NEW")).toHaveLength(1);
  });
});
