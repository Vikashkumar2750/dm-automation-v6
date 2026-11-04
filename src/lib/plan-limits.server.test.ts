import { describe, expect, it } from "vitest";
import { countMonthlySent, resolveOrgLimits } from "./plan-limits.server";
import { vi } from "vitest";

vi.mock("@/lib/platform-config.server", () => ({ readPlatformConfig: async () => ({ plans: [] }) }));

function entitlementClient(parentPlan = "agency", override = false) {
  return { from: (table: string) => ({ select: () => ({ eq: (_key: string, id: string) => ({
    maybeSingle: async () => ({ error: null, data: table === "platform_settings"
      ? { feature_flags: override ? { plan_limits_child: { monthlyDms: 25, maxRules: 2 } } : {} }
      : id === "child" ? { plan: "starter", parent_organization_id: "parent", created_at: "2026-01-01T00:00:00Z" }
      : { plan: parentPlan } }),
  }) }) }) } as never;
}

describe("Agency client automation limits", () => {
  it("uses unlimited Agency quota for an existing Starter client", async () => {
    expect(await resolveOrgLimits(entitlementClient(), "child")).toEqual({ plan: "agency", overridden: false, monthlyDms: null, maxRules: null });
  });
  it("preserves child-specific Super Admin overrides", async () => {
    expect(await resolveOrgLimits(entitlementClient("agency", true), "child")).toEqual({ plan: "agency", overridden: true, monthlyDms: 25, maxRules: 2 });
  });
  it("does not borrow Pro parent benefits after downgrade", async () => {
    expect((await resolveOrgLimits(entitlementClient("pro"), "child")).monthlyDms).toBe(0);
  });
});

describe("plan usage counting", () => {
  it("counts one automation run as 1, using the grouped run count", async () => {
    const admin = { rpc: async (fn: string) => ({ data: fn === "count_org_runs" ? 1 : null, error: null }) } as never;
    // e.g. one comment that triggered a 3-DM flow → 1
    expect(await countMonthlySent(admin, "org")).toBe(1);
  });
});
