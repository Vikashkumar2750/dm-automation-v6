import { describe, expect, it } from "vitest";

import {
  fallbackYouTubeReply,
  videosForPoll,
  youtubeApiReason,
} from "./youtube-automation.server";

const rule = {
  id: "rule",
  name: "YouTube",
  platform: "youtube",
  match_type: "any",
  keywords: [],
  response_text: null,
  response_variations: [],
  comment_reply_text: null,
  comment_reply_variations: [],
  dm_link_url: null,
  target_post_ids: [],
  daily_limit: 100,
  cooldown_seconds: 3600,
  priority: 100,
};

describe("YouTube comment safeguards", () => {
  it("recognizes disabled comments as a per-video condition", () => {
    expect(
      youtubeApiReason({ error: { errors: [{ reason: "commentsDisabled" }] } }),
    ).toBe("commentsDisabled");
  });

  it("keeps recent videos hot while rotating through older uploads", () => {
    const videos = Array.from({ length: 35 }, (_, index) => `video-${index}`);
    const first = videosForPoll(videos, 10);
    const second = videosForPoll(videos, first.next);
    expect(first.ids.slice(0, 10)).toEqual(videos.slice(0, 10));
    expect(first.ids).toContain("video-10");
    expect(second.ids).toContain("video-20");
  });

  it("uses intent-aware fallback replies instead of random text", () => {
    expect(fallbackYouTubeReply("How can I get this?", rule)).toContain("Great question");
    expect(fallbackYouTubeReply("Amazing video, thanks!", rule)).toContain("really glad");
  });
});