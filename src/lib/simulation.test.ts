import { describe, expect, it } from "vitest";
import { extractPayloads } from "./simulation.functions";
import { runSimulated, simulationStore } from "./automation.server";

describe("dry-run mode", () => {
  it("exposes simulated state only inside the run", async () => {
    const state = { follows: true, calls: [] };
    expect(simulationStore.getStore()).toBeUndefined();
    await runSimulated(state, async () => {
      expect(simulationStore.getStore()?.follows).toBe(true);
    });
  });
  it("extracts gate payloads from captured messages", () => {
    const p = extractPayloads([{ payload: { message: { quick_replies: [{ payload: "AUTOMATION_FOLLOW_CHECK:g1:opener:n" }] } } }]);
    expect(p).toEqual(["AUTOMATION_FOLLOW_CHECK:g1:opener:n"]);
  });
});
