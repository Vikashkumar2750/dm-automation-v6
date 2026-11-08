import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(new URL("./buyer-access.functions.ts", import.meta.url), "utf8");
const section = source.slice(source.indexOf("export const getBuyerContent"));
const body = section.slice(section.indexOf(".handler(") + 9).replace(/\);\s*$/, ";")
  .replace('await import("@/integrations/supabase/client.server")', "({ supabaseAdmin: client })")
  .replace('await import("@/lib/product-files.server")', "({ resolveContentUrl: resolveContent })");
const executable = ts.transpileModule(`return ${body}`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;

function scenario(paid: boolean, expired = false, pageExists = true) {
  const filters: Array<[string, string, unknown]> = [];
  const resolve = vi.fn(async () => "https://files.example/private");
  const admin = { from: (table: string) => {
    const rows: Record<string, unknown> = {
      buyer_sessions: { organization_id: "workspace", email: "buyer@example.com", expires_at: new Date(Date.now() + (expired ? -60000 : 60000)).toISOString() },
      delivery_pages: pageExists ? { id: "page", product_id: "product", button_url: null, price_offer_paise: 19900 } : null,
      payment_links: paid ? { id: "purchase" } : null,
      revenue_products: { delivery_url: "file:workspace/guide.pdf" },
    };
    const q = { select: () => q, limit: () => q, eq: (key: string, value: unknown) => { filters.push([table, key, value]); return q; }, maybeSingle: async () => ({ data: rows[table] }) };
    return q;
  } };
  const handler = new Function("client", "resolveContent", "sha256", executable)(admin, resolve, async () => "test-only");
  return { run: () => handler({ data: { token: "test-only", slug: "guide" } }), filters, resolve };
}

describe("buyer private-content authorization", () => {
  it("denies unpaid access before resolving a download", async () => {
    const c = scenario(false);
    await expect(c.run()).rejects.toThrow("Complete payment");
    expect(c.resolve).not.toHaveBeenCalled();
  });
  it("denies expired sessions and unavailable workspace pages", async () => {
    const expired = scenario(true, true);
    await expect(expired.run()).rejects.toThrow("sign in again");
    expect(expired.resolve).not.toHaveBeenCalled();
    const missing = scenario(true, false, false);
    await expect(missing.run()).rejects.toThrow("Content is unavailable");
    expect(missing.resolve).not.toHaveBeenCalled();
  });
  it("resolves only a confirmed paid purchase for the session buyer, page and workspace", async () => {
    const c = scenario(true);
    expect(await c.run()).toEqual({ url: "https://files.example/private" });
    for (const [field, value] of [["organization_id", "workspace"], ["delivery_page_id", "page"], ["external_user_id", "buyer@example.com"], ["status", "paid"], ["platform", "web"]]) expect(c.filters).toContainEqual(["payment_links", field, value]);
    expect(c.resolve).toHaveBeenCalledWith(expect.anything(), "file:workspace/guide.pdf", "workspace");
  });
});