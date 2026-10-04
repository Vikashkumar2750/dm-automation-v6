import { describe, expect, it } from "vitest";

import { canReview, clampLimit, summarizeInvoices, eventForDirection, isApiKeyFormat, matchesAssignment, mustRequestApproval } from "./team-desk";
import { generateApiKey, hmacHex, sha256Hex } from "./team-desk.server";

describe("Phase G team desk rules", () => {
  it("only owner/admin/manager can review", () => {
    expect(canReview("manager")).toBe(true);
    expect(canReview("agent")).toBe(false);
    expect(canReview("viewer")).toBe(false);
  });
  it("agents need approval only when the workspace requires it", () => {
    expect(mustRequestApproval("agent", true)).toBe(true);
    expect(mustRequestApproval("agent", false)).toBe(false);
    expect(mustRequestApproval("manager", true)).toBe(false);
  });
  it("assignment filters", () => {
    expect(matchesAssignment("u1", "mine", "u1")).toBe(true);
    expect(matchesAssignment("u2", "mine", "u1")).toBe(false);
    expect(matchesAssignment(null, "unassigned", "u1")).toBe(true);
  });
  it("API keys are adm_ + 40 chars and hash stably", async () => {
    const k = generateApiKey();
    expect(isApiKeyFormat(k)).toBe(true);
    expect(isApiKeyFormat("adm_short")).toBe(false);
    expect(await sha256Hex(k)).toBe(await sha256Hex(k));
  });
  it("webhook signature is HMAC-SHA256 hex", async () => {
    expect(await hmacHex("key", "The quick brown fox jumps over the lazy dog")).toBe(
      "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8",
    );
  });
  it("API page size defaults to 50, max 100", () => {
    expect(clampLimit(null)).toBe(50);
    expect(clampLimit("500")).toBe(100);
    expect(eventForDirection("inbound")).toBe("message.received");
  });
});

describe("client billing", () => {
  it("counts only unpaid as due and ignores void", () => {
    expect(summarizeInvoices([
      { amount_inr: 999, status: "unpaid" },
      { amount_inr: "500.50", status: "paid" },
      { amount_inr: 2000, status: "void" },
    ])).toEqual({ due: 999, paid: 500.5 });
  });
});
