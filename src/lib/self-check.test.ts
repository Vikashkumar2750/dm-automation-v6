import { describe, expect, it } from "vitest";
import { checkHeartbeats, checkPlanCatalogue } from "./self-check";

describe("self-check", () => {
  it("fails a plan with a negative price", () => {
    const r = checkPlanCatalogue([{ key: "pro", name: "Pro", headline: "", perks: [], options: [{ cycle: "monthly", label: "Monthly", amountPaise: -1, months: 1 }] }] as never);
    expect(r.status).toBe("fail");
  });
  it("passes valid plans and ignores contact-only", () => {
    const r = checkPlanCatalogue([
      { key: "pro", name: "Pro", headline: "", perks: [], options: [{ cycle: "monthly", label: "M", amountPaise: 5900, months: 1 }] },
      { key: "agency", name: "Agency", headline: "", perks: [], options: [], contactOnly: true },
    ] as never);
    expect(r.status).toBe("pass");
  });
  it("flags failing and stale heartbeats", () => {
    const now = Date.parse("2026-01-01T01:00:00Z");
    expect(checkHeartbeats([{ job: "a", last_run_at: "2026-01-01T00:59:00Z", last_status: 500, consecutive_failures: 1 }], now).status).toBe("fail");
    expect(checkHeartbeats([{ job: "a", last_run_at: "2026-01-01T00:00:00Z", last_status: 200, consecutive_failures: 0 }], now).status).toBe("warn");
    expect(checkHeartbeats([{ job: "a", last_run_at: "2026-01-01T00:58:00Z", last_status: 200, consecutive_failures: 0 }], now).status).toBe("pass");
    expect(checkHeartbeats([], now).status).toBe("fail");
  });
});
