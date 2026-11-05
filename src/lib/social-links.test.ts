import { describe, expect, it } from "vitest";
import { cleanSocials, connectedAccountUrl, normalizeSocialUrl } from "./social-links";

describe("social links", () => {
  it("turns a handle into a profile link", () => {
    expect(normalizeSocialUrl("instagram", "@techaasvik")).toBe("https://instagram.com/techaasvik");
  });
  it("rejects links on another domain or javascript", () => {
    expect(normalizeSocialUrl("instagram", "https://evil.com/x")).toBe("");
    expect(cleanSocials([{ platform: "x", url: "javascript:alert(1)" }])).toEqual([]);
  });
  it("builds connected Facebook page link from page id", () => {
    expect(connectedAccountUrl({ platform: "facebook", external_id: "123" })).toBe("https://facebook.com/123");
  });
});
