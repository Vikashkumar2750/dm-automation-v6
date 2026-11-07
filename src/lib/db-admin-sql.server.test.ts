import { describe, expect, it, vi } from "vitest";
import { executeAuditedSql } from "./db-admin-sql.server";

describe("Super Admin SQL audit", () => {
  it("does not execute SQL when its audit record cannot be saved", async () => {
    const rpc = vi.fn();
    const admin = { from: vi.fn(() => ({ insert: vi.fn(async () => ({ error: { message: "unavailable" } })) })), rpc };
    await expect(executeAuditedSql(admin, "actor", "select 1", "editor")).rejects.toThrow("Audit unavailable");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("records the actor and source but never the SQL contents", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    const rpc = vi.fn(async () => ({ data: { rows: [{ count: 1 }] }, error: null }));
    const admin = { from: vi.fn(() => ({ insert })), rpc };
    const sql = "select 'private-value'";
    const result = await executeAuditedSql(admin, "actor", sql, "editor");
    expect(insert).toHaveBeenCalledWith({ actor_user_id: "actor", action: "db_sql.run", target_type: "database", detail: { bytes: new TextEncoder().encode(sql).length, source: "editor" } });
    expect(JSON.stringify(insert.mock.calls)).not.toContain("private-value");
    expect(rpc).toHaveBeenCalledWith("admin_exec_sql", { q: sql });
    expect(result).toEqual({ ok: true, result: { rows: [{ count: 1 }] } });
  });
});