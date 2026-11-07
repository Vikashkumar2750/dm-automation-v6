import { describe, expect, it } from "vitest";
import { INITIAL_SIDEBAR_GROUP, nextSidebarGroup } from "./useSidebarGroup";

describe.each(["user dashboard", "Super Admin"])("%s sidebar groups", () => {
  it("starts with every group closed", () => {
    expect(INITIAL_SIDEBAR_GROUP).toBeNull();
  });
  it("replaces the open group when another group is clicked", () => {
    const first = nextSidebarGroup(INITIAL_SIDEBAR_GROUP, "First");
    expect(first).toBe("First");
    expect(nextSidebarGroup(first, "Second")).toBe("Second");
  });
  it("closes the currently open group when clicked again", () => {
    expect(nextSidebarGroup("First", "First")).toBeNull();
  });
});