import { readFileSync } from "node:fs";
import ts from "typescript";
import { beforeEach, expect, it, vi } from "vitest";
import { clampLimit } from "./team-desk";

const state = vi.hoisted(() => ({ key: null as null | { id: string; organization_id: string; revoked_at: string | null }, keyError: false, sourceError: false, filters: [] as unknown[][] }));
const admin = vi.hoisted(() => ({ from: (table: string) => {
  const q = { select: () => q, order: () => q, limit: () => q, update: () => q,
    eq: (key: string, value: unknown) => { state.filters.push([table, key, value]); return q; }, maybeSingle: () => q,
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({
      data: table === "api_keys" ? state.key : [{ id: "synthetic", conversations: { organization_id: "workspace" } }],
      error: (table === "api_keys" ? state.keyError : state.sourceError) ? { code: "TEST" } : null,
    })),
  }; return q;
} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: admin }));
import { authenticateApiKey } from "./team-desk.server";

const source = readFileSync(new URL("../routes/api/public/v1.$resource.ts", import.meta.url), "utf8");
const body = source.slice(source.indexOf("GET: async") + 5, source.lastIndexOf("},\n    },"))
  .replace('await import("@/lib/team-desk.server")', "({authenticateApiKey})")
  .replace('await import("@/lib/team-desk")', "({clampLimit})")
  .replace('await import("@/integrations/supabase/client.server")', "({supabaseAdmin:admin})");
const js = ts.transpileModule(`return (${body});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const handler = new Function("authenticateApiKey", "clampLimit", "admin", js)(authenticateApiKey, clampLimit, admin);
const key = "adm_" + "a".repeat(40); // Synthetic test-only key.
function request(raw = key, resource = "conversations", query = "") {
  return handler({ request: new Request(`https://app.example/api/public/v1/${resource}${query}`, { headers: { "x-api-key": raw } }), params: { resource } });
}
beforeEach(() => { state.key = { id: "key", organization_id: "workspace", revoked_at: null }; state.keyError = false; state.sourceError = false; state.filters = []; });
it.each(["", "invalid", "adm_" + "b".repeat(39)])("denies malformed or missing keys", async (raw) => {
  expect((await request(raw)).status).toBe(401);
  expect(state.filters).toHaveLength(0);
});
it("denies unknown, revoked and unavailable keys", async () => {
  state.key = null; expect((await request()).status).toBe(401);
  state.key = { id: "key", organization_id: "workspace", revoked_at: "2026-11-08" };
  expect((await request()).status).toBe(401);
  state.key.revoked_at = null; state.keyError = true;
  expect((await request()).status).toBe(401);
});
it("scopes conversations, contacts and message reads to the authenticated workspace", async () => {
  for (const resource of ["conversations", "contacts", "messages"]) {
    const response = await request(key, resource, "?conversation_id=11111111-1111-4111-8111-111111111111&organization_id=other");
    expect(response.status).toBe(200);
  }
  expect(state.filters).toContainEqual(["conversations", "organization_id", "workspace"]);
  expect(state.filters).toContainEqual(["contact_profiles", "organization_id", "workspace"]);
  expect(state.filters).toContainEqual(["messages", "conversations.organization_id", "workspace"]);
});
it.each(["conversations", "contacts", "messages"])("reports unavailable %s reads instead of successful empty results", async (resource) => {
  state.sourceError = true;
  const response = await request(key, resource, "?conversation_id=11111111-1111-4111-8111-111111111111");
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "data_unavailable" });
});