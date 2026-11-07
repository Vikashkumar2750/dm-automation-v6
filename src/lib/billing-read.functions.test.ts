import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("./billing.functions.ts", import.meta.url), "utf8");
const start = source.indexOf(".handler(async ({ data, context }) => {");
const body = source.slice(start + ".handler(".length, source.indexOf("\nexport const createPlanOrder"))
  .replace(/\);\s*$/, ";")
  .replace('await import("@/integrations/supabase/client.server")', "({ supabaseAdmin: admin })")
  .replace('await import("./workspace-entitlements.server")', "({ resolveWorkspaceEntitlements: resolveEntitlement })");
const js = ts.transpileModule(`return ${body}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function client(failed?: string, member = true) {
  const reads: string[] = [];
  return { reads, from(table: string) {
    reads.push(table);
    const result = { data: table === "organizations" ? { plan: "pro" } : table === "organization_members" ? member ? { role: "owner" } : null : [], error: table === failed ? { message: "private detail" } : null };
    const q = { select: () => q, eq: () => q, order: () => q, limit: () => q, maybeSingle: async () => result, then: (resolve: (r: unknown) => unknown) => Promise.resolve(result).then(resolve) };
    return q;
  } };
}
const handler = new Function("admin", "resolveEntitlement", "DEMO_KEY_IDS", js)({}, async () => ({ plan: "pro", plan_expires_at: null, inherited: false }), []);
describe("Billing read integrity", () => {
  it.each(["organizations", "organization_members", "plan_orders"])("rejects failed %s reads", async (table) => {
    await expect(handler({ data: { organizationId: "workspace" }, context: { supabase: client(table), userId: "user" } })).rejects.toThrow("Billing unavailable");
  });
  it("accepts confirmed empty order history", async () => {
    const result = await handler({ data: { organizationId: "workspace" }, context: { supabase: client(), userId: "user" } });
    expect(result.orders).toEqual([]);
    expect(result.plan).toBe("pro");
  });
  it("does not read orders before confirming membership", async () => {
    const sb = client(undefined, false);
    await expect(handler({ data: { organizationId: "workspace" }, context: { supabase: sb, userId: "user" } })).rejects.toThrow("not_a_member");
    expect(sb.reads).not.toContain("plan_orders");
  });
});