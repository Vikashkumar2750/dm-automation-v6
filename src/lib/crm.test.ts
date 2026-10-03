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
      expect(validateFlow(f)).toEqual([]);
    }
  });
});
