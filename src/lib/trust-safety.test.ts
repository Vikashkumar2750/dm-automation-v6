import { describe, expect, it } from "vitest";

import { checkPolicy, computeHealthScore, hasBlockingIssue, isRateLimitError, predictRateRisk } from "./trust-safety";

const now = Date.parse("2026-10-04T00:00:00Z");
const base = { status: "connected", platform: "instagram", tokenExpiresAt: null, sent7d: 0, failed7d: 0, rateLimitErrors24h: 0, webhookErrors24h: 0, lastEventAt: null, now };

describe("account health score", () => {
  it("healthy account scores 100", () => {
    expect(computeHealthScore(base)).toMatchObject({ score: 100, grade: "good" });
  });
  it("expired access drops 40 points", () => {
    expect(computeHealthScore({ ...base, tokenExpiresAt: "2026-10-01T00:00:00Z" }).score).toBe(60);
  });
  it("disconnected + expired is risk", () => {
    expect(computeHealthScore({ ...base, status: "disconnected", tokenExpiresAt: "2026-10-01T00:00:00Z" }).grade).toBe("risk");
  });
});

describe("predictive rate guard", () => {
  it("3 rate-limit errors in 15 min means slow down", () => {
    expect(predictRateRisk({ sentLast10m: 1, sentLastHour: 5, hourlyLimit: 60, rateLimitErrors15m: 3 }).level).toBe("slow_down");
  });
  it("pace at 80% of hourly limit is watch", () => {
    expect(predictRateRisk({ sentLast10m: 8, sentLastHour: 10, hourlyLimit: 60, rateLimitErrors15m: 0 }).level).toBe("watch");
  });
  it("low pace is ok", () => {
    expect(predictRateRisk({ sentLast10m: 1, sentLastHour: 5, hourlyLimit: 60, rateLimitErrors15m: 0 }).level).toBe("ok");
  });
  it("detects Meta rate-limit codes", () => {
    expect(isRateLimitError("(#613) Calls to this api have exceeded the rate limit")).toBe(true);
    expect(isRateLimitError("no_token")).toBe(false);
  });
});

describe("policy checker", () => {
  it("blocks asking for OTP", () => {
    expect(hasBlockingIssue(checkPolicy(["Send me your OTP to claim"]))).toBe(true);
  });
  it("warns on short links but does not block", () => {
    const issues = checkPolicy(["Get it here https://bit.ly/abc"]);
    expect(issues.map((i) => i.rule)).toEqual(["link_shortener"]);
    expect(hasBlockingIssue(issues)).toBe(false);
  });
  it("clean text has no issues", () => {
    expect(checkPolicy(["Thanks! Here is the link: https://shop.example.com/item"])).toEqual([]);
  });
});
