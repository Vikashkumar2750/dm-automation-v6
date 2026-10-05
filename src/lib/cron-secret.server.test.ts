import { describe, it, expect } from "vitest";
import { safeSecretEqual, verifyCronSecret } from "./cron-secret.server";

describe("cron secret check", () => {
  it("accepts the exact secret", () => expect(safeSecretEqual("abc123", "abc123")).toBe(true));
  it("rejects a wrong secret of same length", () => expect(safeSecretEqual("abc124", "abc123")).toBe(false));
  it("rejects a different length", () => expect(safeSecretEqual("abc", "abc123")).toBe(false));
  it("rejects a longer secret with matching prefix", () => expect(safeSecretEqual("abc1234", "abc123")).toBe(false));
  it("rejects missing or empty provided secret", () => {
    expect(safeSecretEqual(null, "abc123")).toBe(false);
    expect(safeSecretEqual("", "abc123")).toBe(false);
  });
  it("rejects when no secret is configured", () => expect(safeSecretEqual("", "")).toBe(false));
  it("accepts the previous secret during rotation", () => expect(verifyCronSecret("old", "new", "old")).toBe(true));
  it("rejects when neither current nor previous match", () => expect(verifyCronSecret("x", "new", "old")).toBe(false));
});
