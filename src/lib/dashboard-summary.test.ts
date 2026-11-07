import { describe, expect, it } from "vitest";
import { summarizeDashboardLeads } from "./dashboard-summary";

describe("dashboard captured lead summary", () => {
  it("counts legacy submissions as complete and partial stages as incomplete", () => {
    expect(summarizeDashboardLeads([
      { answers: {} },
      { answers: { _stage: "completed" } },
      { answers: { _stage: "intent_started" } },
      { answers: { _stage: "otp_pending" } },
      { answers: { _stage: "buyer_signin_attempt" } },
    ])).toEqual({ captured: 5, completed: 2, incomplete: 3 });
  });
  it("returns zero for an empty workspace", () => {
    expect(summarizeDashboardLeads([])).toEqual({ captured: 0, completed: 0, incomplete: 0 });
  });
});