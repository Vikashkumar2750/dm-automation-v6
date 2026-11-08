import { readFileSync } from "node:fs";
import ts from "typescript";
import { z } from "zod";
import { expect, it, vi } from "vitest";

function scenario(role = true, roleError = false, auditError = false) {
  const source = readFileSync(new URL("./drive-backup.functions.ts", import.meta.url), "utf8")
    .replace(/^import .*;\s*$/gm, "").replace(/export const /g, "const ")
    .replace('await import("@/integrations/supabase/client.server")', "({ supabaseAdmin: admin })")
    .replace(/await import\("@\/lib\/drive-oauth.server"\)/g, "({ readDriveConnection: async () => ({ connected: false, email: null, connectedAt: null }), oauthClient: () => null })");
  const js = ts.transpileModule(source + "\nreturn {getDriveBackup, updateDriveBackup};", { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  const writes = vi.fn();
  const admin = { from(table: string) {
    const q = { select: () => q, eq: () => q, single: async () => ({ data: { feature_flags: { workflows_enabled: true } }, error: null }),
      insert: async () => ({ error: auditError ? {} : null }), update: (value: unknown) => { writes(value); return q; },
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolve({ error: null })) };
    return q;
  } };
  const builder = () => { const b = { middleware: () => b, inputValidator: () => b, handler: (fn: unknown) => fn }; return b; };
  const env = { GOOGLE_DRIVE_API_KEY: "test-only", LOVABLE_API_KEY: "test-only", NITRO_PRESET: "node-server", DRIVE_BACKUP_DATABASE_URL: "test-only" };
  const fns = new Function("getRequest", "createServerFn", "z", "requireSupabaseAuth", "admin", "process", "crypto", js)(() => ({}), builder, z, {}, admin, { env }, { randomUUID: () => "request" });
  const context = { userId: "actor", supabase: { rpc: async () => ({ data: role, error: roleError ? {} : null }) } };
  return { fns, context, writes, env };
}
it.each([[false, false], [true, true]])("denies backup settings and requests when protected role check fails", async (role, error) => {
  const c = scenario(role, error);
  await expect(c.fns.getDriveBackup({ context: c.context })).rejects.toThrow("Forbidden");
  await expect(c.fns.updateDriveBackup({ context: c.context, data: { action: "run" } })).rejects.toThrow("Forbidden");
  expect(c.writes).not.toHaveBeenCalled();
});
it("requires audit success before queuing a backup", async () => {
  const c = scenario(true, false, true);
  await expect(c.fns.updateDriveBackup({ context: c.context, data: { action: "run" } })).rejects.toThrow("Audit unavailable");
  expect(c.writes).not.toHaveBeenCalled();
});
it("preserves unrelated platform flags when requesting a backup", async () => {
  const c = scenario();
  await c.fns.updateDriveBackup({ context: c.context, data: { action: "run" } });
  expect(c.writes).toHaveBeenCalledWith(expect.objectContaining({ feature_flags: { workflows_enabled: true, __drive_backup: { requestedBy: "actor", requestId: "request", status: "queued" } } }));
});
it("blocks managed preview without explicit independent-host setup", async () => {
  const c = scenario();
  c.env.NITRO_PRESET = "cloudflare";
  await expect(c.fns.updateDriveBackup({ context: c.context, data: { action: "run" } })).rejects.toThrow("not the Cloud preview");
  expect(c.writes).not.toHaveBeenCalled();
});