import { describe, expect, it } from "vitest";

import { sanitizeFlows, validateFlow } from "@/lib/flows";
import { buildFunnel, makeCouponCode, nudgeDue, rupeesToPaise } from "@/lib/revenue";
import { validRazorpaySignature } from "@/lib/revenue.server";
import { createHmac } from "node:crypto";

const HOUR = 3600_000;

describe("revenue rules", () => {
  it("rejects prices under ₹1 and converts rupees to paise", () => {
    expect(rupeesToPaise("0.5")).toBeNull();
    expect(rupeesToPaise("499")).toBe(49900);
  });

  it("coupon codes use the prefix plus 6 characters", () => {
    expect(makeCouponCode("diwali", () => 0)).toBe("DIWALI-AAAAAA");
  });

  it("reminder waits for the delay and only inside 24h of the last message", () => {
    const now = Date.now();
    const link = { status: "created", nudged_at: null, created_at: new Date(now - 3 * HOUR).toISOString() };
    expect(nudgeDue(link, new Date(now - 3 * HOUR).toISOString(), 120, now)).toBe(true);
    expect(nudgeDue(link, new Date(now - 3 * HOUR).toISOString(), 240, now)).toBe(false);
    expect(nudgeDue(link, new Date(now - 24 * HOUR).toISOString(), 120, now)).toBe(false);
    expect(nudgeDue({ ...link, nudged_at: new Date().toISOString() }, new Date(now).toISOString(), 120, now)).toBe(false);
    expect(nudgeDue({ ...link, status: "paid" }, new Date(now).toISOString(), 120, now)).toBe(false);
  });

  it("funnel shows step-to-step conversion", () => {
    const f = buildFunnel({ dmsSent: 100, pageViews: 50, pageClicks: 25, paymentLinks: 20, paid: 5, revenuePaise: 0 });
    expect(f[1]!.rate).toBe(50);
    expect(f[4]!.rate).toBe(25);
  });

  it("only accepts Razorpay webhooks signed with the workspace secret", () => {
    const body = '{"event":"payment_link.paid"}';
    const sig = createHmac("sha256", "s3cret").update(body).digest("hex");
    expect(validRazorpaySignature(body, sig, "s3cret")).toBe(true);
    expect(validRazorpaySignature(body, sig, "other")).toBe(false);
    expect(validRazorpaySignature(body, null, "s3cret")).toBe(false);
  });

  it("coupon step must include {code}", () => {
    const [flow] = sanitizeFlows([{ name: "c", trigger: "new_dm", steps: [{ kind: "send_coupon", campaignId: "x", text: "hi" }] }]);
    expect(validateFlow(flow!)).toContain("Step 1: message must include {code}.");
  });
});
