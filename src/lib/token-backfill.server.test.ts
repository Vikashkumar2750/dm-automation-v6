import { afterEach, describe, expect, it, vi } from "vitest";
import { backfillEncryptedTokens } from "./token-backfill.server";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("./token-crypto.server", () => ({ tokenKey: () => "test-only", isSealed: (s: string) => s?.startsWith("enc:v1:"), sealSecret: async () => "enc:v1:test-only" }));

function mockClient(readError = false, changed: unknown[] = [{ social_account_id: "account" }]) {
  const filters: string[] = [];
  const updates: Record<string, string>[] = [];
  const from = vi.fn((table: string) => ({
    select: () => {
      const read = {
        not: () => read,
        or: (filter: string) => { filters.push(filter); return read; },
        limit: async () => ({ error: readError ? { message: "private database error" } : null, data: table === "social_account_tokens" ? [{ social_account_id: "account", access_token: "enc:v1:existing", refresh_token: "test-only" }] : [] }),
      };
      return read;
    },
    update: (patch: Record<string, string>) => {
      updates.push(patch);
      const write = { eq: () => write, is: () => write, select: async () => ({ data: changed, error: null }), then: (resolve: (v: unknown) => void) => Promise.resolve({ data: changed, error: null }).then(resolve) };
      return write;
    },
  }));
  return { admin: { from } as unknown as SupabaseClient, filters, updates };
}

afterEach(() => vi.clearAllMocks());
describe("encryption backfill integrity", () => {
  it("rejects failed source reads rather than reporting encryption completion", async () => {
    const { admin } = mockClient(true);
    await expect(backfillEncryptedTokens(admin)).rejects.toThrow("Encryption source unavailable");
  });
  it("includes plaintext refresh tokens even when access tokens are already encrypted", async () => {
    const { admin, filters, updates } = mockClient();
    await backfillEncryptedTokens(admin);
    expect(filters[0]).toContain("refresh_token.not.like.enc:v1:%");
    expect(updates[0]).toEqual({ refresh_token: "enc:v1:test-only" });
  });
  it("does not count a concurrent reconnect that matched no rows as a sealed record", async () => {
    const { admin } = mockClient(false, []);
    expect(await backfillEncryptedTokens(admin)).toEqual({ enabled: true, sealed: 0 });
  });
});