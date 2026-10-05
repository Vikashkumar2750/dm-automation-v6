import { describe, expect, it } from "vitest";
import { isSealed, openSecret, sealSecret } from "./token-crypto.server";

const KEY = Buffer.alloc(32, 7).toString("base64");

describe("token crypto", () => {
  it("round-trips a sealed token", async () => {
    const sealed = await sealSecret("EAAG-token", KEY);
    expect(isSealed(sealed)).toBe(true);
    expect(sealed.includes("EAAG-token")).toBe(false);
    expect(await openSecret(sealed, KEY)).toBe("EAAG-token");
  });
  it("passes legacy plaintext through unchanged", async () => {
    expect(await openSecret("plain", undefined)).toBe("plain");
  });
  it("rejects a wrong key", async () => {
    const sealed = await sealSecret("x", KEY);
    await expect(openSecret(sealed, Buffer.alloc(32, 1).toString("base64"))).rejects.toThrow();
  });
  it("refuses sealed value without key", async () => {
    const sealed = await sealSecret("x", KEY);
    await expect(openSecret(sealed, undefined)).rejects.toThrow("encryption_key_missing");
  });
});
