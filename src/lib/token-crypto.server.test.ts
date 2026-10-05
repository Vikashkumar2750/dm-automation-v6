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

import { readToken, storeToken, tokenKey } from "./token-crypto.server";
import { afterEach } from "vitest";

describe("token store/read with TOKEN_ENCRYPTION_KEY", () => {
  const KEY2 = Buffer.alloc(32, 7).toString("base64");
  afterEach(() => { delete process.env["TOKEN_ENCRYPTION_KEY"]; });

  it("stores encrypted and reads back the same token when key is set", async () => {
    process.env["TOKEN_ENCRYPTION_KEY"] = KEY2;
    const stored = await storeToken("EAAG-page-token");
    expect(isSealed(stored)).toBe(true);
    expect(stored).not.toContain("EAAG");
    expect(await readToken(stored)).toBe("EAAG-page-token");
  });
  it("legacy plaintext still reads (migrated later by backfill)", async () => {
    process.env["TOKEN_ENCRYPTION_KEY"] = KEY2;
    expect(await readToken("legacy-plain")).toBe("legacy-plain");
  });
  it("rejects a key that is not 32 bytes", () => {
    process.env["TOKEN_ENCRYPTION_KEY"] = Buffer.alloc(16, 1).toString("base64");
    expect(() => tokenKey()).toThrow("encryption_key_must_be_32_bytes");
  });
  it("fails on corrupted ciphertext instead of returning garbage", async () => {
    process.env["TOKEN_ENCRYPTION_KEY"] = KEY2;
    const stored = (await storeToken("abc"))!;
    const broken = stored.slice(0, -4) + "AAAA";
    await expect(readToken(broken)).rejects.toThrow();
  });
  it("sealed token cannot be read when the key is missing", async () => {
    process.env["TOKEN_ENCRYPTION_KEY"] = KEY2;
    const stored = await storeToken("abc");
    delete process.env["TOKEN_ENCRYPTION_KEY"];
    await expect(readToken(stored)).rejects.toThrow("encryption_key_missing");
  });
  it("without a key, tokens are stored unchanged (pre-rollout)", async () => {
    expect(await storeToken("plain")).toBe("plain");
  });
});
