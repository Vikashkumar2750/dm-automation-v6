import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as growth from "./growth";

// Execute the actual handler body without TanStack's RPC transform, using only a fake RLS client.
const source = readFileSync(new URL("./growth.functions.ts", import.meta.url), "utf8");
const handler = source.slice(source.indexOf(".handler(async ({ data, context }) => {") + ".handler(".length, source.indexOf("\nconst competitorInput"));
const executable = ts.transpileModule(`const handler = ${handler.replace(/\);\s*$/, ";")}\nreturn handler;`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const getGrowthOverview = new Function(...Object.keys(growth), "DAY", executable)(...Object.values(growth), 86_400_000);

const workspace = "5d554ef6-101b-4bc6-9272-5ee6fa31a9ba";
function sourceClient(failedTable?: string) {
  const filters: Array<[string, string, unknown]> = [];
  return {
    filters,
    from(table: string) {
      const q = {
        select: () => q,
        eq: (field: string, value: unknown) => { filters.push([table, field, value]); return q; },
        or: () => q,
        gte: () => q,
        order: () => q,
        in: () => q,
        limit: () => q,
        then: (resolve: (result: unknown) => unknown) => Promise.resolve(resolve({
          data: table === failedTable ? null : table === "conversations" ? [{ id: "conversation" }] : [],
          error: table === failedTable ? { code: "42501", message: "private source error details" } : null,
        })),
      };
      return q;
    },
  };
}

const overview = getGrowthOverview as unknown as (input: { data: { organizationId: string }; context: { supabase: ReturnType<typeof sourceClient> } }) => Promise<{ sampleSize: number; anomalies: unknown[] }>;

describe("Growth source-read integrity", () => {
  it.each(["conversations", "automation_runs", "revenue_events", "posts", "growth_competitors", "social_accounts", "messages"])("identifies failed %s reads without logging private details", async (table) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(overview({ data: { organizationId: workspace }, context: { supabase: sourceClient(table) } })).rejects.toThrow("Growth insights unavailable");
      expect(log.mock.calls).toEqual([["growth_overview_read_failed", { source: table, code: "42501" }]]);
    } finally {
      log.mockRestore();
    }
  });

  it.each(["conversations", "automation_runs", "revenue_events", "posts", "growth_competitors", "social_accounts", "messages"])("rejects failed %s reads instead of reporting zero/normal insights", async (table) => {
    await expect(overview({ data: { organizationId: workspace }, context: { supabase: sourceClient(table) } }))
      .rejects.toThrow("Growth insights unavailable");
  });

  it("accepts confirmed empty reads and keeps all direct reads workspace-scoped", async () => {
    const client = sourceClient();
    const result = await overview({ data: { organizationId: workspace }, context: { supabase: client } });
    expect(result.sampleSize).toBe(0);
    expect(result.anomalies).toEqual([]);
    for (const table of ["conversations", "automation_runs", "revenue_events", "posts", "growth_competitors", "social_accounts"]) {
      expect(client.filters).toContainEqual([table, "organization_id", workspace]);
    }
  });
});