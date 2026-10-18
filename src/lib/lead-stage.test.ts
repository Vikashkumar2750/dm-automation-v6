import { describe, expect, it } from "vitest";
import { nextLeadStage } from "./delivery-page";

describe("lead drop-off stage", () => {
  it("moves forward from typing to WhatsApp code", () => expect(nextLeadStage("intent_started", "otp_pending")).toBe("otp_pending"));
  it("never goes back once completed", () => expect(nextLeadStage("completed", "intent_started")).toBe("completed"));
  it("sign-in attempt upgrades when the form is filled", () => expect(nextLeadStage("buyer_signin_attempt", "intent_started")).toBe("intent_started"));
  it("old rows without a stage count as completed", () => expect(nextLeadStage(undefined, "otp_pending")).toBe("completed"));
});
