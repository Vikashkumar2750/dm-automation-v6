import { describe, expect, it } from "vitest";
import { captionFor } from "./publishing.functions";

describe("captionFor", () => {
  it("puts the YouTube title first and tags as hashtags", () => {
    expect(captionFor("youtube", { caption: "c", youtubeTitle: "My video", youtubeDescription: "desc", youtubeTags: ["cook", "food"] }))
      .toBe("My video\n\ndesc\n\n#cook #food");
  });
  it("falls back to the shared caption on YouTube", () => {
    expect(captionFor("youtube", { caption: "hello" })).toBe("hello");
  });
  it("adds the title as the first Instagram caption line", () => {
    expect(captionFor("instagram", { caption: "body", title: "Hi" })).toBe("Hi\n\nbody");
  });
});
