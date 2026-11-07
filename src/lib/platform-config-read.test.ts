import { describe, expect, it } from "vitest";
import { readPlatformConfig, PLANS as unused } from "./platform-config.server";

function client(error: unknown, data: unknown = null) {
  return { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data, error }) }) }) }) } as never;
}
describe("Strict plan catalogue reads", () => {
  it("rejects failed catalogue reads rather than returning default prices", async () => {
    await expect(readPlatformConfig(client({ message: "private detail" }), { strictReads: true })).rejects.toThrow("Plan catalogue unavailable");
  });
  it("accepts a confirmed unset catalogue", async () => {
    expect((await readPlatformConfig(client(null), { strictReads: true })).plans.length).toBeGreaterThan(0);
  });
  it("keeps legacy configuration consumers unchanged", async () => {
    expect((await readPlatformConfig(client({ message: "unavailable" }))).plans.length).toBeGreaterThan(0);
  });
});