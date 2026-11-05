import { describe, expect, it } from "vitest";
import { publishingMode, publishingModeFlags } from "./publishing-availability";

describe("publishing tab availability", () => {
  it("keeps both existing tabs enabled until the admin changes them", () => {
    expect(publishingMode({}, "create_post")).toBe("enabled");
    expect(publishingMode({}, "calendar")).toBe("enabled");
  });
  it("hides Create Post independently from Calendar", () => {
    const flags = publishingModeFlags("create_post", "hidden");
    expect(publishingMode(flags, "create_post")).toBe("hidden");
    expect(publishingMode(flags, "calendar")).toBe("enabled");
  });
  it("shows Coming soon instead of enabling Calendar", () => {
    const flags = publishingModeFlags("calendar", "coming_soon");
    expect(flags["calendar_enabled"]).toBe(false);
    expect(publishingMode(flags, "calendar")).toBe("coming_soon");
    expect(publishingMode(flags, "create_post")).toBe("enabled");
  });
  it("restores a previously unavailable tab", () => {
    const flags = { ...publishingModeFlags("calendar", "coming_soon"), ...publishingModeFlags("calendar", "enabled") };
    expect(publishingMode(flags, "calendar")).toBe("enabled");
    expect(flags["calendar_coming_soon"]).toBe(false);
  });
});