import { afterEach, describe, expect, it, vi } from "vitest";
import { startPageCheckout } from "@/lib/revenue.server";

vi.mock("@/lib/token-crypto.server", () => ({ readToken: async () => "test-only" }));
afterEach(() => vi.unstubAllGlobals());

function client() {
  const rows: Record<string, unknown> = {
    delivery_pages: { id: "page", organization_id: "workspace", title: "Guide", product_id: "product", price_offer_paise: 19900, button_url: null },
    delivery_page_leads: { id: "lead", answers: { email: "buyer@example.com", _stage: "completed" } },
    payment_credentials: { razorpay_key_id: "test-only", razorpay_key_secret: "test-only" },
    revenue_products: { name: "Guide", price_paise: 29900, currency: "INR", active: true },
  };
  const filters: Array<[string, string, unknown]> = [];
  const inserts: Array<[string, unknown]> = [];
  const admin = { from: (table: string) => {
    const q = {
      select: () => q,
      eq: (field: string, value: unknown) => { filters.push([table, field, value]); return q; },
      maybeSingle: async () => ({ data: rows[table] ?? null }),
      insert: async (row: unknown) => { inserts.push([table, row]); return { error: null }; },
    };
    return q;
  } };
  return { admin, filters, inserts };
}

describe("automatic page checkout", () => {
  it("creates a fresh buyer link on each checkout without a manual URL", async () => {
    const c = client();
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ id: "plink_one", short_url: "https://rzp.io/one" }))
      .mockResolvedValueOnce(Response.json({ id: "plink_two", short_url: "https://rzp.io/two" }));
    vi.stubGlobal("fetch", fetcher);
    expect(await startPageCheckout(c.admin as never, "guide", "lead", "https://store.example.com")).toBe("https://rzp.io/one");
    expect(await startPageCheckout(c.admin as never, "guide", "lead", "https://store.example.com")).toBe("https://rzp.io/two");
    const payload = JSON.parse(fetcher.mock.calls[0]?.[1].body);
    expect(payload.amount).toBe(29900);
    expect(payload.callback_url).toBe("https://store.example.com/api/public/paid/guide");
    expect(c.filters).toContainEqual(["revenue_products", "organization_id", "workspace"]);
    expect(c.inserts.filter(([table]) => table === "payment_links")).toHaveLength(2);
  });

  it("does not deliver private content when payment-link creation fails", async () => {
    const c = client();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Unavailable", { status: 503 })));
    await expect(startPageCheckout(c.admin as never, "guide", "lead", "https://store.example.com")).rejects.toThrow("Razorpay");
    expect(c.inserts.filter(([table]) => table === "payment_links")).toHaveLength(0);
  });
});