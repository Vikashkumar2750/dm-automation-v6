import { describe, expect, it } from "vitest";
import { teamDeskNeedsInbox, teamDeskTab } from "./team-desk-navigation";

describe("merged Team Desk access", () => {
  it("does not require inbox sources for members, reports or integrations", () => {
    expect(teamDeskNeedsInbox("members")).toBe(false);
    expect(teamDeskNeedsInbox("reports")).toBe(false);
    expect(teamDeskNeedsInbox("api")).toBe(false);
    expect(teamDeskNeedsInbox("inbox")).toBe(true);
    expect(teamDeskNeedsInbox("approvals")).toBe(true);
  });
  it("keeps member management available when advanced tools are off", () => {
    expect(teamDeskTab("inbox", false, true)).toBe("members");
    expect(teamDeskTab("members", false, false)).toBe("members");
  });
  it("opens legacy Team destinations at members even with advanced tools on", () => {
    expect(teamDeskTab("members", true, true)).toBe("members");
  });
  it("does not select reviewer integrations for agents or viewers", () => {
    expect(teamDeskTab("api", true, false)).toBe("inbox");
    expect(teamDeskTab("api", true, true)).toBe("api");
  });
  it("defaults unknown tabs safely while preserving report and approval destinations", () => {
    expect(teamDeskTab("__proto__", true, true)).toBe("inbox");
    expect(teamDeskTab("reports", true, true)).toBe("reports");
    expect(teamDeskTab("approvals", true, false)).toBe("approvals");
  });
});