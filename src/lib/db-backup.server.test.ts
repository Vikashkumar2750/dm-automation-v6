import { describe, expect, it } from "vitest";
import { orderTables, rowsToSql } from "./db-backup.server";

describe("db backup", () => {
  it("puts parent tables before children", () => {
    const o = orderTables([{ table_name: "members", depends_on: "organizations" }, { table_name: "organizations", depends_on: null }]);
    expect(o.indexOf("organizations")).toBeLessThan(o.indexOf("members"));
  });
  it("makes re-runnable inserts that survive dollar signs in data", () => {
    const s = rowsToSql("posts", [{ id: 1, body: "price $j$ 5" }]);
    expect(s).toContain("ON CONFLICT DO NOTHING");
    expect(s).toContain("$jx$");
  });
  it("rejects unsafe table names", () => {
    expect(() => rowsToSql("x; drop", [])).toThrow();
  });
});
