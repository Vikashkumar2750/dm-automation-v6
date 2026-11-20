import { describe, expect, it } from "vitest";
import { normalizeStoryInput, normalizeStoryRule } from "./entry-points";

describe("story-only targeting", () => {
  const input = { trigger: "story_mention", platform: "facebook", targetPostIds: ["live-post"], matchType: "contains", keywords: ["price"], action: "comment_private_reply", commentReplyText: "public", commentReplyVariations: ["reply"] };
  it("mentions match any tag, have no feed targets and send only a DM", () => {
    expect(normalizeStoryInput(input)).toMatchObject({ platform: "instagram", targetPostIds: [], matchType: "any", keywords: [], action: "reply_dm", commentReplyText: null, commentReplyVariations: [] });
  });
  it("story replies retain explicit keyword matching but not feed targets", () => {
    expect(normalizeStoryInput({ ...input, trigger: "story_reply" })).toMatchObject({ targetPostIds: [], matchType: "contains", keywords: ["price"] });
  });
  it.each(["comment_received", "dm_received"])("leaves %s settings untouched", (trigger) => {
    const rule = { ...input, trigger };
    expect(normalizeStoryInput(rule)).toBe(rule);
  });
  it("normalizes legacy story rows without mutating saved data", () => {
    const rule = { trigger: "story_mention", platform: null, target_post_ids: ["post"], match_type: "contains", keywords: ["cost"], action: "comment_private_reply", comment_reply_text: "reply", comment_reply_variations: [] };
    expect(normalizeStoryRule(rule)).toMatchObject({ target_post_ids: [], match_type: "any", keywords: [], action: "reply_dm" });
    expect(rule.target_post_ids).toEqual(["post"]);
  });
});