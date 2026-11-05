import { describe, expect, it } from "vitest";
import { withCharges } from "@/lib/revenue";

describe("withCharges", () => {
  it("no charges keeps the selling price", () => {
    expect(withCharges(99900).totalPaise).toBe(99900);
  });
  it("adds 18% GST on the selling price", () => {
    expect(withCharges(100000, { gstPercent: 18 })).toMatchObject({ gstPaise: 18000, feePaise: 0, totalPaise: 118000 });
  });
  it("grosses up the 2.36% Razorpay fee so the creator nets price + GST", () => {
    const b = withCharges(100000, { gstPercent: 18, passFee: true });
    expect(b.totalPaise).toBe(120853);
    expect(b.totalPaise - Math.round(b.totalPaise * 0.0236)).toBeGreaterThanOrEqual(118000);
  });
});
