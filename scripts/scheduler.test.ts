import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

describe("Railway scheduler", () => {
  it("bounds every request and reports non-success heartbeat responses", async () => {
    let tick: (() => Promise<void>) | undefined;
    const timeout = vi.fn(() => ({}));
    const error = vi.fn();
    const fetcher = vi.fn(async (url: string) => ({ status: url.endsWith("/heartbeat") ? 503 : 200, text: async () => '{}' }));
    runInNewContext(readFileSync(new URL("./scheduler.mjs", import.meta.url), "utf8"), {
      process: { env: { CRON_SECRET: "test-only", PORT: "3000" } },
      fetch: fetcher, AbortSignal: { timeout }, Date,
      console: { log: vi.fn(), warn: vi.fn(), error },
      setTimeout: (callback: () => Promise<void>) => { tick = callback; }, setInterval: vi.fn(),
    });
    if (!tick) throw new Error("Scheduler did not start");
    await tick(); await tick(); await tick();
    expect(timeout).toHaveBeenCalledWith(25000);
    expect(error).toHaveBeenCalledWith("[scheduler] ALERT heartbeat failing", 3, "heartbeat status 503");
    expect(fetcher.mock.calls.some(([url]) => url.endsWith("/db-backup"))).toBe(false);
  });
});