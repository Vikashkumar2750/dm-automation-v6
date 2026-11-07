import { expect, it } from "vitest";
import { summarizeIncomingEvents } from "./admin-overview-summary";

it("excludes unsigned probes from delivery failures while keeping their audit count", () => {
  expect(summarizeIncomingEvents([
    { signature_valid: false, status: "failed" },
    { signature_valid: false, status: "rejected" },
    { signature_valid: true, status: "failed" },
    { signature_valid: true, status: "processed" },
  ])).toEqual({ deliveryFailures: 1, rejectedProbes: 2 });
});

it("reports zero confirmed failures for a processed-only sample", () => {
  expect(summarizeIncomingEvents([{ signature_valid: true, status: "processed" }])).toEqual({ deliveryFailures: 0, rejectedProbes: 0 });
});