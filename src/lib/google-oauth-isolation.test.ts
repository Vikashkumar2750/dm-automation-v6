import { readFileSync } from "node:fs";
import ts from "typescript";
import { expect, it } from "vitest";
import { z } from "zod";

it("YouTube consent excludes previously granted Drive permissions", async () => {
  const source = readFileSync(new URL("./social-accounts.functions.ts", import.meta.url), "utf8");
  const start = source.indexOf("export const startSocialConnect");
  const end = source.indexOf("export const checkWebhookDelivery");
  const handlerSource = source.slice(start, end)
    .replace("export const", "const")
    .replace('await import("@/integrations/supabase/client.server")', "({ supabaseAdmin: admin })")
    .replace('await import("@/lib/allowed-origin.server")', "({ trustedOrigin: (origin) => origin })")
    .replace('await import("@/lib/social")', "({ metaScopes: [], googleScopes: scopes })");
  const js = ts.transpileModule(handlerSource + "\nreturn startSocialConnect;", {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const builder = () => {
    const chain = { middleware: () => chain, inputValidator: () => chain, handler: (fn: unknown) => fn };
    return chain;
  };
  const scopes = ["https://www.googleapis.com/auth/youtube.readonly", "https://www.googleapis.com/auth/youtube.force-ssl", "https://www.googleapis.com/auth/youtube.upload"];
  const connect = new Function("createServerFn", "requireSupabaseAuth", "z", "googleCredentials", "process", "crypto", "admin", "scopes", js)(
    builder, {}, z, () => ({ clientId: "test-client", clientSecret: "test-only" }), { env: {} },
    { randomUUID: () => "test-state" }, { from: () => ({ insert: async () => ({ error: null }) }) }, scopes,
  );
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { role: "owner" } }) };
  const result = await connect({ data: { organizationId: "test-org", platform: "youtube", origin: "https://example.test" }, context: { userId: "test-user", supabase: { from: () => query } } });
  const url = new URL(result.url);
  expect(url.searchParams.get("include_granted_scopes")).toBe("false");
  expect(url.searchParams.get("scope")?.split(" ")).toEqual(scopes);
  expect(url.searchParams.get("redirect_uri")).toBe("https://example.test/api/public/oauth/google/callback");
});

it("Drive consent requests only drive.file and excludes prior YouTube grants", () => {
  const source = readFileSync(new URL("./drive-oauth.server.ts", import.meta.url), "utf8");
  const start = source.indexOf("export function authUrl");
  const end = source.indexOf("type Admin", start);
  const js = ts.transpileModule(source.slice(start, end).replace("export function", "function") + "\nreturn authUrl;", {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const driveScope = "https://www.googleapis.com/auth/drive.file";
  const authUrl = new Function("DRIVE_SCOPE", js)(driveScope);
  const url = new URL(authUrl("test-client", "https://example.test/api/public/drive-oauth/callback", "test-state"));
  expect(url.searchParams.get("scope")).toBe(driveScope);
  expect(url.searchParams.get("include_granted_scopes")).toBe("false");
  expect(url.searchParams.get("access_type")).toBe("offline");
});