import { expect, it } from "vitest";
import { filterAdminWorkspaces } from "./admin-directory";
const rows = [
  { name: "Beta", slug: "client-02", plan: "agency", automationsPaused: true, accounts: 4, created_at: "2026-11-01" },
  { name: "Alpha", slug: "owner-01", plan: "starter", automationsPaused: false, accounts: 1, created_at: "2026-11-02" },
];
it("combines slug search with exact plan and pause filters", () => {
  expect(filterAdminWorkspaces(rows, " CLIENT-02 ", "agency", "paused", "newest")).toEqual([rows[0]]);
  expect(filterAdminWorkspaces(rows, "", "agency", "active", "newest")).toEqual([]);
});
it("sorts a copy without altering the cached workspace order", () => {
  expect(filterAdminWorkspaces(rows, "", "all", "all", "name").map((row) => row.name)).toEqual(["Alpha", "Beta"]);
  expect(filterAdminWorkspaces(rows, "", "all", "all", "newest")[0]).toBe(rows[1]);
  expect(filterAdminWorkspaces(rows, "", "all", "all", "accounts")[0]).toBe(rows[0]);
  expect(rows[0]?.name).toBe("Beta");
});
it("searches owners and filters effective inherited plan expiry within seven days", () => {
  const row = { ...rows[0], name: "Client", slug: "client", plan: "starter", automationsPaused: false, accounts: 1, created_at: "2026-11-01", ownerEmail: "owner@example.test", effectivePlan: "agency", planExpiresAt: "2026-11-10T00:00:00Z" };
  const now = Date.parse("2026-11-07T00:00:00Z");
  expect(filterAdminWorkspaces([row], "owner@example", "agency", "all", "newest", "soon", now)).toEqual([row]);
  expect(filterAdminWorkspaces([row], "", "all", "all", "newest", "expired", now)).toEqual([]);
  expect(filterAdminWorkspaces([row], "", "all", "all", "newest", "expired", Date.parse("2026-11-11T00:00:00Z"))).toEqual([row]);
});