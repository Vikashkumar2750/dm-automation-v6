import { readFileSync } from "node:fs";
import ts from "typescript";
import { expect, it } from "vitest";

function teamCheck(failed?: string) {
  const source = readFileSync(new URL("./self-check.functions.ts", import.meta.url), "utf8");
  const section = source.slice(source.indexOf("// 7. Team Desk"), source.indexOf("return { ranAt:"));
  const js = ts.transpileModule(`async function run(admin, missing) { const results = []; ${section}; return results; }`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const run = new Function(`${js}; return run;`)();
  const columns: Record<string, string[]> = {
    conversation_assignments: ["conversation_id", "assigned_to"],
    reply_approvals: ["id", "status"],
    team_settings: ["organization_id", "require_approval"],
  };
  const admin = { from(table: string) {
    let valid = false;
    const q = {
      select(fields: string) { valid = fields.split(",").every((field) => columns[table]?.includes(field.trim())); return q; },
      limit() { return q; },
      then(resolve: (result: unknown) => unknown) {
        return Promise.resolve(resolve({ data: [], error: !valid || failed === table ? { code: "42703" } : null }));
      },
    };
    return q;
  } };
  return run(admin, failed ? [failed] : []);
}

it("accepts assignment storage keyed by conversation_id, without a synthetic id", async () => {
  expect(await teamCheck()).toMatchObject([{ id: "team-desk", status: "pass" }]);
});

it.each(["conversation_assignments", "reply_approvals", "team_settings"])("fails an unreadable %s source", async (table) => {
  expect(await teamCheck(table)).toMatchObject([{ id: "team-desk", status: "fail" }]);
});