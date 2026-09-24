import { describe, expect, it } from "vitest";

import { hmacSha256Hex, verifyMetaSignature } from "@/routes/api/public/webhooks.meta";

describe("Meta webhook signature verification", () => {
  it("accepts the exact signed body", async () => {
    const body = JSON.stringify({ object: "instagram", entry: [] });
    const signature = await hmacSha256Hex("test-secret", body);
    await expect(verifyMetaSignature("test-secret", body, `sha256=${signature}`)).resolves.toBe(true);
  });

  it("rejects missing, altered, or differently signed bodies", async () => {
    const body = JSON.stringify({ object: "instagram", entry: [] });
    const signature = await hmacSha256Hex("test-secret", body);
    await expect(verifyMetaSignature("test-secret", body, "")).resolves.toBe(false);
    await expect(verifyMetaSignature("test-secret", `${body} `, `sha256=${signature}`)).resolves.toBe(false);
    await expect(verifyMetaSignature("other-secret", body, `sha256=${signature}`)).resolves.toBe(false);
  });
});