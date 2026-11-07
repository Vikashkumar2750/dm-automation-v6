import { describe, expect, it } from "vitest";
import { countActiveRules, countMonthlySent, readMonthlyRunUsage, resolveOrgLimits } from "./plan-limits.server";
import { vi } from "vitest";

vi.mock("@/lib/platform-config.server", async (importOriginal) => ({
  ...await importOriginal<typeof import("./platform-config.server")>(),
  readPlatformConfig: async () => ({ plans: [] }),
}));

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

describe("monthly usage display", () => {
  it.each([0, 1, 25])("returns confirmed grouped run count %s without reading step rows", async (count) => {
    const rpc = vi.fn().mockResolvedValue({ data: count, error: null });
    const from = vi.fn();
    expect(await readMonthlyRunUsage({ rpc, from } as never, "org")).toBe(count);
    expect(rpc).toHaveBeenCalledWith("count_org_runs", expect.objectContaining({ _org_id: "org" }));
    expect(from).not.toHaveBeenCalled();
  });

  it.each([
    { data: null, error: { message: "private database detail" } },
    { data: 0, error: { message: "private database detail" } },
    { data: null, error: null },
    { data: "1", error: null },
    { data: -1, error: null },
    { data: 1.5, error: null },
    { data: NaN, error: null },
  ])("rejects unavailable or invalid grouped counts without a step fallback: %j", async (result) => {
    const from = vi.fn();
    await expect(readMonthlyRunUsage({ rpc: async () => result, from } as never, "org"))
      .rejects.toThrow("Monthly plan usage unavailable");
    expect(from).not.toHaveBeenCalled();
  });

  it("leaves the existing sending-quota fallback unchanged", async () => {
    const query = { select: () => query, eq: () => query, gte: async () => ({ count: 3, error: null }) };
    const admin = { rpc: async () => ({ data: null, error: { message: "RPC unavailable" } }), from: () => query } as never;
    expect(await countMonthlySent(admin, "org")).toBe(3);
  });
});

function displayClient(failedSource?: string, missingWorkspace = false) {
  const filters: unknown[] = [];
  const client = {
    from(table: string) {
      let id = "";
      const result = () => ({
        data: table === "platform_settings"
          ? { feature_flags: { plan_limits_child: { monthlyDms: 25, maxRules: 2 } } }
          : missingWorkspace && id === "child" ? null
          : id === "child" ? { plan: "starter", parent_organization_id: "parent", created_at: "2026-01-01T00:00:00Z" }
          : { plan: "agency" },
        count: 0,
        error: failedSource === table || failedSource === id ? { message: "private detail" } : null,
      });
      const q = {
        select: () => q,
        eq: (key: string, value: unknown) => { filters.push([table, key, value]); if (key === "id") id = String(value); return q; },
        maybeSingle: async () => result(),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
      };
      return q;
    },
  };
  return { client: client as never, filters };
}

describe("strict plan usage source reads", () => {
  it.each(["child", "platform_settings", "parent"])("rejects failed %s reads instead of displaying default plan limits", async (source) => {
    await expect(resolveOrgLimits(displayClient(source).client, "child", { strictReads: true })).rejects.toThrow();
  });
  it("rejects a missing workspace rather than reporting Starter defaults", async () => {
    await expect(resolveOrgLimits(displayClient(undefined, true).client, "child", { strictReads: true })).rejects.toThrow("Plan limits unavailable");
  });
  it("keeps confirmed child overrides and inherited Agency access", async () => {
    expect(await resolveOrgLimits(displayClient().client, "child", { strictReads: true }))
      .toEqual({ plan: "agency", overridden: true, monthlyDms: 25, maxRules: 2 });
  });
  it("rejects a failed active-rule count instead of showing zero", async () => {
    await expect(countActiveRules(displayClient("automation_rules").client, "child", undefined, { strictReads: true }))
      .rejects.toThrow("Active rule usage unavailable");
  });
  it("accepts confirmed zero active rules scoped to the workspace", async () => {
    const { client, filters } = displayClient();
    expect(await countActiveRules(client, "child", undefined, { strictReads: true })).toBe(0);
    expect(filters).toContainEqual(["automation_rules", "organization_id", "child"]);
    expect(filters).toContainEqual(["automation_rules", "is_active", true]);
  });
  it("preserves legacy rule-enforcement read behavior", async () => {
    expect(await countActiveRules(displayClient("automation_rules").client, "child")).toBe(0);
  });
});
