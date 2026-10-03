import { describe, expect, it } from "vitest";
import { detectStoryEvent, entryPointsActiveFor, readEntryPointFlags, sanitizeEntryConfig } from "./entry-points.server";

describe("entry points", () => {
  it("ignores normal DMs and echoes", () => {
    expect(detectStoryEvent({ message: { text: "price" } })).toBeNull();
    expect(detectStoryEvent({ message: { is_echo: true, reply_to: { story: {} } } })).toBeNull();
    expect(detectStoryEvent({ postback: { payload: "x" } })).toBeNull();
  });
  it("detects story reply and mention", () => {
    expect(detectStoryEvent({ message: { text: "wow", reply_to: { story: { id: "1" } } } })).toBe("story_reply");
    expect(detectStoryEvent({ message: { attachments: [{ type: "story_mention" }] } })).toBe("story_mention");
  });
  it("is on by default", () => {
    expect(entryPointsActiveFor(readEntryPointFlags({}), "o")).toBe(true);
    expect(entryPointsActiveFor(readEntryPointFlags({ entry_points_enabled: false }), "o")).toBe(false);
    expect(entryPointsActiveFor(readEntryPointFlags({ entry_points_enabled: true, entry_points_orgs: ["a"] }), "o")).toBe(false);
  });
  it("sanitizes config", () => {
    const c = sanitizeEntryConfig({ iceBreakers: [1,2,3,4,5].map((n) => ({ question: `q${n}` })), menu: [{ title: "x", url: "http://bad" }] });
    expect(c.iceBreakers).toHaveLength(4);
    expect(c.menu[0]!.url).toBeNull();
  });
});
