import { describe, expect, it } from "vitest";
import { featureOn, overridesKey, resolveWorkspaceFeatures, sanitizeOverrides } from "./workspace-features";

const ORG = "11111111-1111-1111-1111-111111111111";

describe("workspace feature overrides", () => {
  it("defaults keep Team Desk and Growth Insights on", () => {
    const f = resolveWorkspaceFeatures({}, ORG);
    expect(f.team_desk).toBe("enabled");
    expect(f.growth).toBe("enabled");
    expect(f.revenue).toBe("enabled");
  });
  it("workspace override wins over the platform switch", () => {
    const flags = { create_post_enabled: false, [overridesKey(ORG)]: { create_post: "enabled", revenue: "hidden" } };
    const f = resolveWorkspaceFeatures(flags, ORG);
    expect(f.create_post).toBe("enabled");
    expect(f.revenue).toBe("hidden");
    expect(featureOn(f, "revenue")).toBe(false);
  });
  it("other workspaces are not affected", () => {
    const flags = { [overridesKey(ORG)]: { revenue: "hidden" } };
    expect(resolveWorkspaceFeatures(flags, "22222222-2222-2222-2222-222222222222").revenue).toBe("enabled");
  });
  it("view only still counts as visible, invalid values are dropped", () => {
    expect(featureOn(resolveWorkspaceFeatures({ [overridesKey(ORG)]: { revenue: "view_only" } }, ORG), "revenue")).toBe(true);
    expect(sanitizeOverrides({ revenue: "bogus", team_desk: "off", ai_monthly_cap: 500 })).toEqual({ team_desk: "off", ai_monthly_cap: 500 });
  });
});
