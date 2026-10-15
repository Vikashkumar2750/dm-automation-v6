import { describe, expect, it } from "vitest";
import { DASH_CATEGORIES, DASH_TEMPLATES, templatesFor } from "./dashboard-templates";

describe("dashboard templates", () => {
  it("every filter has at least 4 templates", () => {
    for (const c of DASH_CATEGORIES) expect(templatesFor(c.key).length).toBeGreaterThanOrEqual(4);
  });
  it("All starts with the 4 popular cards from the design", () => {
    expect(templatesFor("all").slice(0, 4).map((t) => t.key)).toEqual(["link-keyword", "story-reaction", "follow-gate", "dm-auto"]);
  });
  it("All shows every template once", () => {
    expect(templatesFor("all").length).toBe(DASH_TEMPLATES.length);
  });
});
