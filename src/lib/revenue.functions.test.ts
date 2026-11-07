import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Exercise the real read handler without the RPC transform or live credentials.
const source = readFileSync(new URL("./revenue.functions.ts", import.meta.url), "utf8");
const start = source.indexOf(".handler(async ({ data, context }) => {") + ".handler(".length;
const body = source.slice(start, source.indexOf("\nexport const saveProduct"))
  .replace(/\);\s*$/, ";")
  .replace('await import("@/integrations/supabase/client.server")', "({ supabaseAdmin: admin })");
const executable = ts.transpileModule(`return ${body}`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const workspace = "5d554ef6-101b-4bc6-9272-5ee6fa31a9ba";
const account = "4d554ef6-101b-4bc6-9272-5ee6fa31a9ba";
const tables = ["revenue_products", "delivery_pages", "coupon_campaigns", "revenue_settings", "payment_links", "revenue_events", "automation_runs", "delivery_page_leads", "social_accounts", "payment_credentials", "whatsapp_otp_settings"];

function client(failed?: string, member = true) {
  const filters: Array<[string, string, unknown]> = [];
  const reads: string[] = [];
  const sb = { from(table: string) {
    reads.push(table);
    const q = {
      select: () => q,
      eq: (field: string, value: unknown) => { filters.push([table, field, value]); return q; },
      or: (value: string) => { filters.push([table, "or", value]); return q; },
      order: () => q, gte: () => q, limit: () => q, maybeSingle: () => q,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({
        data: table === "organizations" ? (member ? { id: workspace } : null) : ["revenue_settings", "payment_credentials", "whatsapp_otp_settings"].includes(table) ? null : [],
        error: table === failed ? { message: "private database details" } : null,
        count: table === failed ? null : 0,
      })),
    };
    return q;
  } };
  const assertMember = async () => {
    const res = await sb.from("organizations").select().eq("id", workspace).maybeSingle();
    if (!(res as unknown as { data: unknown }).data) throw new Error("not_a_member");
  };
  const read = new Function("admin", "assertMember", executable)(sb, assertMember) as (args: unknown) => Promise<any>;
  return { filters, reads, run: () => read({ data: { organizationId: workspace, socialAccountId: account }, context: { supabase: sb, userId: "user" } }) };
}

describe("Revenue source-read integrity", () => {
  it.each(tables)("rejects failed %s reads rather than false empty results", async (table) => {
    await expect(client(table).run()).rejects.toThrow("Sales and Revenue unavailable");
  });
  it("accepts confirmed empty reads and preserves workspace/account scoping", async () => {
    const c = client();
    const result = await c.run();
    expect(result.products).toEqual([]);
    expect(result.funnel.revenuePaise).toBe(0);
    expect(result.razorpay).toBeNull();
    for (const table of tables) expect(c.filters).toContainEqual([table, "organization_id", workspace]);
    expect(c.filters).toContainEqual(["payment_links", "or", `social_account_id.eq.${account}`]);
  });
  it("never reads private payment settings for a non-member", async () => {
    const c = client(undefined, false);
    await expect(c.run()).rejects.toThrow("not_a_member");
    expect(c.reads).not.toContain("payment_credentials");
    expect(c.reads).not.toContain("whatsapp_otp_settings");
  });
});