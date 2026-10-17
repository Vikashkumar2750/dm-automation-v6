import { describe, expect, it } from "vitest";

import { hashOtp, normalizePhone } from "@/lib/whatsapp-otp.server";

describe("normalizePhone", () => {
  it("adds India country code to 10-digit mobiles", () => {
    expect(normalizePhone("9876543210")).toBe("919876543210");
  });
  it("strips a leading 0 before adding the country code", () => {
    expect(normalizePhone("09876543210")).toBe("919876543210");
  });
  it("keeps an existing country code and drops formatting", () => {
    expect(normalizePhone("+91 98765 43210")).toBe("919876543210");
  });
});

describe("hashOtp", () => {
  it("is deterministic and never returns the raw code", () => {
    const h = hashOtp("123456");
    expect(h).toBe(hashOtp("123456"));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain("123456");
  });
  it("differs per code", () => {
    expect(hashOtp("123456")).not.toBe(hashOtp("123457"));
  });
});
