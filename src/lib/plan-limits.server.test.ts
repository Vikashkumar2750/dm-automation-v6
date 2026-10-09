import { describe, expect, it } from "vitest";
import { countMonthlySent } from "./plan-limits.server";

describe("plan usage counting", () => {
  it("counts one automation run as 1, using the grouped run count", async () => {
    const admin = { rpc: async (fn: string) => ({ data: fn === "count_org_runs" ? 1 : null, error: null }) } as never;
    // e.g. one comment that triggered a 3-DM flow → 1
    expect(await countMonthlySent(admin, "org")).toBe(1);
  });
});
