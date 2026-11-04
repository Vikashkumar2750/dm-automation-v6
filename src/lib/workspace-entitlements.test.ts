import { describe, expect, it } from "vitest";
import { effectiveWorkspacePlan, socialAccountLimit } from "./workspace-entitlements";

const now = Date.UTC(2026, 10, 4);
const child = { plan: "starter", parent_organization_id: "parent" };
describe("Agency client entitlements", () => {
  it("gives existing Starter clients active parent Agency benefits", () => {
    expect(effectiveWorkspacePlan(child, { plan: "agency" }, now).plan).toBe("agency");
  });
  it("permits unlimited client social accounts under Agency", () => {
    expect(socialAccountLimit(effectiveWorkspacePlan(child, { plan: "agency" }, now).plan)).toBeNull();
  });
  it("inherits the parent expiry", () => {
    const expiry = "2026-12-04T00:00:00Z";
    expect(effectiveWorkspacePlan(child, { plan: "agency", plan_expires_at: expiry }, now).plan_expires_at).toBe(expiry);
  });
  it("removes inherited Agency when the parent expires", () => {
    expect(effectiveWorkspacePlan({ ...child, plan: "agency", plan_source: "agency_parent" },
      { plan: "agency", plan_expires_at: "2026-11-04T00:00:00Z" }, now).plan).toBe("starter");
  });
  it("removes inherited Agency on parent downgrade or deletion", () => {
    const inherited = { ...child, plan: "agency", plan_source: "agency_parent" };
    expect(effectiveWorkspacePlan(inherited, { plan: "pro" }, now).plan).toBe("starter");
    expect(effectiveWorkspacePlan(inherited, null, now).plan).toBe("starter");
  });
  it("does not grant Agency to unrelated workspaces", () => {
    expect(effectiveWorkspacePlan({ plan: "starter" }, { plan: "agency" }, now).plan).toBe("starter");
  });
  it("keeps Free and Pro account caps", () => {
    expect(socialAccountLimit("starter")).toBe(1);
    expect(socialAccountLimit("pro")).toBe(5);
    expect(socialAccountLimit("unknown")).toBe(1);
  });
});