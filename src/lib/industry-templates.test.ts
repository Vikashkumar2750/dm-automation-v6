import { describe, expect, it } from "vitest";
import { parseBody } from "./delivery-page";
import { INDUSTRIES, industryByKey } from "./industry-templates";

describe("industry templates", () => {
  it("includes the requested industries", () => {
    for (const k of ["real_estate", "nbfc", "marketing_agency"]) expect(industryByKey(k).key).toBe(k);
  });
  it("unknown industry falls back to general", () => {
    expect(industryByKey("nope").key).toBe("general");
  });
  it("every industry has page, product and coupon templates with valid content", () => {
    for (const i of INDUSTRIES) {
      expect(i.pages.length && i.products.length && i.coupons.length).toBeTruthy();
      for (const p of i.pages) {
        expect(parseBody(p.body)[0]?.t).toBe("h1");
        expect(p.body.length).toBeLessThanOrEqual(8000);
        if (p.priceOffer) expect(Number(p.priceOffer)).toBeLessThanOrEqual(Number(p.priceOriginal || p.priceOffer));
      }
      for (const c of i.coupons) expect(c.prefix).toMatch(/^[A-Z0-9]{2,12}$/);
    }
  });
});
