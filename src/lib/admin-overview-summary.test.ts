import { expect, it } from "vitest";
import { alertFeedState, incomingProcessingRate, summarizeIncomingEvents } from "./admin-overview-summary";

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

it("measures finalized verified outcomes without unsigned probes or pending deliveries", () => {
  expect(incomingProcessingRate([
    { signature_valid: false, status: "failed" },
    { signature_valid: false, status: "processed" },
    { signature_valid: true, status: "processed" },
    { signature_valid: true, status: "failed" },
    { signature_valid: true, status: "received" },
  ])).toEqual({ processed: 1, failed: 1, pending: 1, completed: 2, rate: 50 });
});

it("never reports 100 percent for empty or unfinished samples", () => {
  expect(incomingProcessingRate([]).rate).toBeNull();
  expect(incomingProcessingRate([{ signature_valid: true, status: "received" }]).rate).toBeNull();
  expect(incomingProcessingRate([{ signature_valid: true, status: "processed" }]).rate).toBe(100);
});

it("never treats missing, failed or filtered alert reads as a confirmed empty feed", () => {
  expect(alertFeedState(false, true, false, 0, 0)).toBe("loading");
  expect(alertFeedState(false, false, true, 0, 0)).toBe("unavailable");
  expect(alertFeedState(true, false, true, 0, 0)).toBe("stale");
  expect(alertFeedState(true, false, false, 2, 0)).toBe("filtered");
  expect(alertFeedState(true, false, false, 0, 0)).toBe("empty");
  expect(alertFeedState(true, false, true, 2, 2)).toBe("items");
});