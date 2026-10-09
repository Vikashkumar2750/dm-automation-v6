import { describe, expect, it } from "vitest";
import { contactsToCsv, extractContactInfo, matchesSegment, normalizeTag, type CrmContact } from "./crm";
import { FLOW_TEMPLATES, flowFromTemplate } from "./flow-templates";
import { validateFlow } from "./flows";

const c: CrmContact = { key: "instagram:1", name: "Asha", platform: "instagram", tags: ["vip"], email: "a@x.com", phone: null, lastAt: "2026-10-01" };

describe("crm", () => {
  it("segment by tag and platform", () => {
    expect(matchesSegment(c, { tag: "vip", platform: "instagram" })).toBe(true);
    expect(matchesSegment(c, { tag: "cold" })).toBe(false);
    expect(matchesSegment(c, { platform: "facebook" })).toBe(false);
  });
  it("segment requiring phone excludes contacts without one", () => {
    expect(matchesSegment(c, { hasPhone: true })).toBe(false);
    expect(matchesSegment(c, { hasEmail: true })).toBe(true);
  });
  it("csv escapes commas", () => {
    expect(contactsToCsv([{ ...c, name: "A, B" }]).split("\n")[1]).toContain('"A, B"');
  });
  it("extracts email and phone", () => {
    expect(extractContactInfo("mail me at ravi@shop.in or +91 98765 43210")).toEqual({ email: "ravi@shop.in", phone: "+919876543210" });
  });
  it("normalizes tags", () => expect(normalizeTag(" Hot Lead! ")).toBe("hot-lead"));
});

describe("flow templates", () => {
  it("every template creates a valid draft flow", () => {
    for (const t of FLOW_TEMPLATES) {
      const f = flowFromTemplate(t.key)!;
      expect(f.active).toBe(false);
      // Payment / coupon templates only wait for the user to pick their own product or campaign.
      expect(validateFlow(f).filter((x) => !/choose a (product|coupon campaign)/.test(x))).toEqual([]);
    }
  });
});

import { pageLeadsToCsv } from "./crm";
describe("delivery page lead export", () => {
  it("puts name, email, phone, pincode first and adds custom answers and page", () => {
    const csv = pageLeadsToCsv([{ id: "1", pageTitle: "Webinar", pageSlug: "webinar", createdAt: "2026-10-09", answers: { name: "Asha", email: "a@x.in", phone: "9999999999", pincode: "110001", city: "Delhi" } }]);
    const [head, row] = csv.split("\n");
    expect(head).toBe("name,email,phone,pincode,city,page,page_link,submitted_at");
    expect(row).toBe('"Asha","a@x.in","9999999999","110001","Delhi","Webinar","/p/webinar","2026-10-09"');
  });
});
