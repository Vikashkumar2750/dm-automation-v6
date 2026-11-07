import { expect, it } from "vitest";
import { adminWorkspacesToCsv, filterAdminWorkspaces } from "./admin-directory";
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

it("exports only filtered rows in display order, keeping assigned and inherited access separate", () => {
  const exportRows = rows.map((row, index) => ({ ...row, id: `workspace-${index}`, members: 2, conversations: 3, posts: 5, effectivePlan: "agency", inherited: index === 1, parentId: index === 1 ? "workspace-0" : null, planExpiresAt: "2026-11-10T00:00:00Z" }));
  const csv = adminWorkspacesToCsv(filterAdminWorkspaces(exportRows, "", "agency", "active", "name"));
  const lines = csv.split("\r\n");
  expect(lines).toHaveLength(2);
  expect(lines[1]).toContain('"workspace-1","Alpha","owner-01"');
  expect(lines[1]).toContain('"starter","agency","2026-11-10T00:00:00Z","Yes","workspace-0"');
  expect(csv).not.toContain('"Beta"');
});

it("escapes formula-prefixed owner fields, quotes and multiline workspace names", () => {
  const csv = adminWorkspacesToCsv([{ ...rows[0], id: "workspace-0", members: 1, conversations: 0, posts: 0, name: 'A, "quoted"\nworkspace', ownerName: "=HYPERLINK(1)", ownerEmail: "+unsafe@example.test" }]);
  expect(csv).toContain('"A, ""quoted""\nworkspace"');
  expect(csv).toContain('"\'=HYPERLINK(1)"');
  expect(csv).toContain('"\'+unsafe@example.test"');
});

it("exports a header-only file for an empty snapshot", () => {
  const csv = adminWorkspacesToCsv([]);
  expect(csv.split("\r\n")).toHaveLength(1);
  expect(csv).toContain('"Workspace ID"');
});