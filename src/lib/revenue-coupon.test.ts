import { describe, expect, it } from "vitest";
import { couponPrice, parseDiscount } from "./revenue";

describe("coupon on selling price", () => {
  it("MRP 499, offer 199, 20% coupon pays 159.20", () => {
    expect(couponPrice(49900, 19900, { type: "percent", value: 20 })).toEqual({ basePaise: 19900, discountPaise: 3980, pricePaise: 15920 });
  });
  it("flat coupon off selling price and never below ₹1", () => {
    expect(couponPrice(50000, 30000, { type: "flat", paise: 10000 }).pricePaise).toBe(20000);
    expect(couponPrice(50000, 30000, { type: "flat", paise: 900000 }).pricePaise).toBe(100);
  });
  it("without MRP the selling price is the base", () => {
    expect(couponPrice(null, 100000, { type: "percent", value: 10 }).pricePaise).toBe(90000);
  });
  it("reads discount labels", () => {
    expect(parseDiscount("20% OFF")).toEqual({ type: "percent", value: 20 });
    expect(parseDiscount("₹1,000 off")).toEqual({ type: "flat", paise: 100000 });
    expect(parseDiscount("Free gift")).toBeNull();
  });
});
