import { describe, expect, it } from "vitest";
import { effectiveAccountLimits, resolveCaps } from "./account-safety";

const ws = { hourly: 60, daily: 500, perContact: 3 };

describe("per-account safety limits", () => {
  it("uses workspace defaults when an account has no override", () => {
    expect(effectiveAccountLimits(ws, null, resolveCaps({}, "o1"))).toEqual({ hourly: 60, daily: 500, perContact: 3 });
  });
  it("clamps a user value above the max to 150/hour, 1500/day, 5 journeys", () => {
    expect(effectiveAccountLimits(ws, { hourly: 999, daily: 9999, perContact: 50 }, resolveCaps({}, "o1"))).toEqual({ hourly: 150, daily: 1500, perContact: 5 });
  });
  it("per-workspace caps win over global caps", () => {
    const flags = { safety_caps: { hourly: 100 }, safety_caps_o1: { hourly: 40 } };
    expect(resolveCaps(flags, "o1").hourly).toBe(40);
    expect(resolveCaps(flags, "o2").hourly).toBe(100);
  });
  it("never allows more than 200/hour even if Super Admin sets higher", () => {
    expect(resolveCaps({ safety_caps_o1: { hourly: 500 } }, "o1").hourly).toBe(200);
  });
});
