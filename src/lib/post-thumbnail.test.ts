import { describe, expect, it } from "vitest";
import { postThumbnail } from "./post-thumbnail";
describe("post thumbnails", () => {
  it("prioritizes Instagram reel thumbnail_url over media_url", () => { expect(postThumbnail({ media_type: "VIDEO", media_url: "reel.mp4", thumbnail_url: "poster.jpg" })).toBe("poster.jpg"); });
  it("prioritizes Facebook thumbnail_url when supplied", () => { expect(postThumbnail({ media_url: "reel.mp4", full_picture: "feed.jpg", thumbnail_url: "poster.jpg" })).toBe("poster.jpg"); });
  it("keeps reel video for first-frame preview", () => { expect(postThumbnail({ media_url: "reel.mp4?expires=1" })).toBe("reel.mp4?expires=1"); expect(postThumbnail({ media_type: "VIDEO", media_url: "https://cdn/x" })).toBe("https://cdn/x#video"); });
  it("retains Facebook full_picture posters", () => { expect(postThumbnail({ full_picture: "fb.jpg" })).toBe("fb.jpg"); });
});