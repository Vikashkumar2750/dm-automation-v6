import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { effectiveAccountLimits, resolveCaps } from "./account-safety";

function handler(file: string, exportName: string, end: string) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const start = source.indexOf(".handler(", source.indexOf(`export const ${exportName}`)) + ".handler(".length;
  const body = source.slice(start, source.indexOf(end, start)).replace(/\);\s*$/, ";")
    .replace('await import("@/integrations/supabase/client.server")', "({ supabaseAdmin: admin })")
    .replace('await import("@/lib/plan-limits.server")', "({ monthStartIso })");
  const js = ts.transpileModule(`return ${body}`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  return new Function("admin", "monthStartIso", "effectiveAccountLimits", "resolveCaps", js);
}

const workspace = "5d554ef6-101b-4bc6-9272-5ee6fa31a9ba";
function client(failedIndex = -1, member = true) {
  let index = 0;
  const filters: Array<[string, string, unknown]> = [];
  const reads: string[] = [];
  const sb = {
    rpc: async () => ({ data: member, error: null }),
    from(table: string) {
      reads.push(table);
      const failed = index++ === failedIndex;
      const q = {
        select: () => q, order: () => q, limit: () => q, maybeSingle: () => q,
        eq: (key: string, value: unknown) => { filters.push([table, key, value]); return q; },
        gte: () => q,
        then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolve({ data: table === "social_accounts" || table === "automation_runs" ? [] : null, count: failed ? null : 0, error: failed ? { message: "private source details" } : null })),
      };
      return q;
    },
  };
  return { sb, filters, reads };
}

const usageFactory = handler("./automations.functions.ts", "getAutomationUsage", "\nexport const resumeAutomations");
const safetyFactory = handler("./account-safety.functions.ts", "getAccountSafety", "\nconst limitSchema");

describe.each([
  { label: "Workspace usage", factory: usageFactory, count: 6, error: "Usage unavailable" },
  { label: "Account safety", factory: safetyFactory, count: 5, error: "Per-account usage unavailable" },
])("$label source integrity", ({ factory, count, error }) => {
  const run = (c: ReturnType<typeof client>) => factory(c.sb, () => "2026-11-01T00:00:00.000Z", effectiveAccountLimits, resolveCaps)({ data: { organizationId: workspace }, context: { supabase: c.sb } });
  it.each(Array.from({ length: count }, (_, i) => i))("rejects failed source %s rather than false zero/default values", async (i) => {
    await expect(run(client(i))).rejects.toThrow(error);
  });
  it("accepts confirmed empty reads", async () => {
    const c = client();
    const result = await run(c);
    if (factory === usageFactory) expect(result.sentLastDay).toBe(0);
    else expect(result.accounts).toEqual([]);
    expect(c.filters).toContainEqual(["automation_runs", "organization_id", workspace]);
  });
});

it("does not read account safety data without membership", async () => {
  const c = client(-1, false);
  const run = safetyFactory(c.sb, () => "2026-11-01", effectiveAccountLimits, resolveCaps);
  await expect(run({ data: { organizationId: workspace }, context: { supabase: c.sb } })).rejects.toThrow("Forbidden");
  expect(c.reads).toEqual([]);
});