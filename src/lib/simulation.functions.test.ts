import { describe, expect, it } from "vitest";

import { resolveSimulatorAllowed } from "./simulation.functions";

describe("resolveSimulatorAllowed", () => {
  it("is disabled by default when no flags exist", () => {
    expect(resolveSimulatorAllowed({}, "org-1", "user-1")).toBe(false);
  });

  it("allows when the workspace is opted in", () => {
    expect(resolveSimulatorAllowed({ simulator_org_org1: true }, "org1", "user-1")).toBe(true);
  });

  it("allows when only the user is opted in", () => {
    expect(
      resolveSimulatorAllowed({ simulator_user_org1_user1: true }, "org1", "user1"),
    ).toBe(true);
  });

  it("denies an individually opted-out user even in an enabled workspace", () => {
    expect(
      resolveSimulatorAllowed(
        { simulator_org_org1: true, simulator_user_deny_org1_user1: true },
        "org1",
        "user1",
      ),
    ).toBe(false);
  });
});
