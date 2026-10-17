import { describe, expect, it } from "vitest";

import { DELIVERY_TEMPLATES, inlineParts, parseBody } from "./delivery-page";

describe("delivery page formatting", () => {
  it("turns headings, bullets, notes and FAQ lines into blocks", () => {
    const b = parseBody("# Hello\nIntro\n\n## Inside\n- One\n- Two\n> Note\n? Free? | Yes");
    expect(b.map((x) => x.t)).toEqual(["h1", "p", "h2", "list", "quote", "faq"]);
    expect(b[3]).toEqual({ t: "list", items: ["One", "Two"] });
    expect(b[5]).toEqual({ t: "faq", q: "Free?", a: "Yes" });
  });
  it("keeps raw HTML as plain text", () => {
    expect(parseBody("<script>x</script>")).toEqual([{ t: "p", text: "<script>x</script>" }]);
  });
  it("splits bold text", () => {
    expect(inlineParts("a **b** c")).toEqual([{ bold: false, text: "a " }, { bold: true, text: "b" }, { bold: false, text: " c" }]);
  });
  it("every template starts with an H1 and fits the size limit", () => {
    for (const t of DELIVERY_TEMPLATES) {
      expect(parseBody(t.body)[0]?.t).toBe("h1");
      expect(t.body.length).toBeLessThanOrEqual(8000);
    }
  });
});

import { priceDisplay, validateLeadValue } from "./delivery-page";

describe("delivery page price box", () => {
  it("shows 50% off when 1999 is cut to 999", () => {
    const p = priceDisplay(199900, 99900);
    expect(p.original).toBe("₹1,999");
    expect(p.offer).toBe("₹999");
    expect(p.badge).toBe("50% OFF");
  });
  it("hides the cut price and badge when offer is not lower", () => {
    const p = priceDisplay(99900, 99900);
    expect(p.original).toBeNull();
    expect(p.badge).toBeNull();
  });
  it("uses a custom discount label", () => {
    expect(priceDisplay(200000, 100000, "Diwali deal").badge).toBe("Diwali deal");
  });
});

describe("lead form checks", () => {
  it("accepts a 6-digit pincode and rejects 5 digits", () => {
    expect(validateLeadValue({ type: "pincode", required: true, options: [] }, "110001")).toBeNull();
    expect(validateLeadValue({ type: "pincode", required: true, options: [] }, "11001")).not.toBeNull();
  });
  it("requires 10 to 15 phone digits", () => {
    expect(validateLeadValue({ type: "phone", required: true, options: [] }, "98123 45670")).toBeNull();
    expect(validateLeadValue({ type: "phone", required: true, options: [] }, "12345")).not.toBeNull();
  });
});

import { validateLeadValue as vlv, isFakePhone } from "./delivery-page";
describe("lead anti-fake validation", () => {
  const email = { type: "email" as const, required: true, options: [] };
  const phone = { type: "phone" as const, required: true, options: [] };
  it("rejects temporary inboxes", () => expect(vlv(email, "a@mailinator.com")).not.toBeNull());
  it("accepts a normal email", () => expect(vlv(email, "a@gmail.com")).toBeNull());
  it("rejects repeated-digit phones", () => expect(isFakePhone("9999999999")).toBe(true));
  it("rejects Indian mobiles not starting 6-9", () => expect(vlv(phone, "5123456789")).not.toBeNull());
  it("accepts a real Indian mobile", () => expect(vlv(phone, "+91 98123 45678")).toBeNull());
});
