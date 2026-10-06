import { describe, expect, it } from "vitest";
import { planButtonState } from "./plans";

const now = Date.UTC(2026, 9, 6);
const inDays = (d: number) => new Date(now + d * 864e5).toISOString();

describe("planButtonState", () => {
  it("locks other plans while current plan has more than 7 days", () => {
    expect(planButtonState("pro", "agency", inDays(20), now)).toBe("locked");
    expect(planButtonState("agency", "agency", inDays(20), now)).toBe("active");
  });
  it("shows renew on current within 7 days, others still locked", () => {
    expect(planButtonState("agency", "agency", inDays(5), now)).toBe("renew");
    expect(planButtonState("pro", "agency", inDays(5), now)).toBe("locked");
  });
  it("unlocks all plans after expiry, current stays renew", () => {
    expect(planButtonState("pro", "agency", inDays(-1), now)).toBe("buy");
    expect(planButtonState("agency", "agency", inDays(-1), now)).toBe("renew");
  });
  it("paid plan with no end date locks others", () => {
    expect(planButtonState("starter", "pro", null, now)).toBe("locked");
  });
});
