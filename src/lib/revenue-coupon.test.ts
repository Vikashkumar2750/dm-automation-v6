import { describe, expect, it } from "vitest";
import { couponPrice, parseDiscount } from "./revenue";

describe("coupon on MRP", () => {
  it("20% is taken off the MRP, not the selling price", () => {
    expect(couponPrice(299900, 99900, { type: "percent", value: 20 })).toEqual({ basePaise: 299900, discountPaise: 59980, pricePaise: 239920 });
  });
  it("MRP 499 with 20% off pays 399.20", () => {
    expect(couponPrice(49900, 19900, { type: "percent", value: 20 }).pricePaise).toBe(39920);
  });
  it("flat coupon off MRP and never below ₹1", () => {
    expect(couponPrice(50000, 30000, { type: "flat", paise: 10000 }).pricePaise).toBe(40000);
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
