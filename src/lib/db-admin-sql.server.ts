type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type SqlResult = { rows?: JsonValue[]; affected?: number };
type SqlAdmin = {
  from: (table: string) => { insert: (record: Record<string, unknown>) => PromiseLike<{ error: unknown }> };
  rpc: (name: string, params: { q: string }) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

/** Skip only leading SQL trivia so the existing database classifier sees the statement.
 * Never rewrite strings, query bodies or subsequent statements, and never retry execution.
 */
function withoutLeadingComments(sql: string): string {
  let position = 0;
  while (position < sql.length) {
    if (/\s/.test(sql[position])) { position += 1; continue; }
    if (sql.startsWith("--", position)) {
      const end = sql.indexOf("\n", position + 2);
      position = end < 0 ? sql.length : end + 1;
      continue;
    }
    if (sql.startsWith("/*", position)) {
      const start = position;
      let depth = 1;
      position += 2;
      while (position < sql.length && depth > 0) {
        if (sql.startsWith("/*", position)) { depth += 1; position += 2; }
        else if (sql.startsWith("*/", position)) { depth -= 1; position += 2; }
        else position += 1;
      }
      // Preserve invalid input for the database to reject instead of silently correcting it.
      if (depth > 0) return sql.slice(start);
      continue;
    }
    break;
  }
  return sql.slice(position);
}

/** Authorize the caller before invoking this helper. Never store SQL or result values in audit rows. */
export async function executeAuditedSql(admin: SqlAdmin, userId: string, sql: string, source: "editor" | "import") {
  const { error: auditError } = await admin.from("platform_audit_log").insert({
    actor_user_id: userId,
    action: source === "import" ? "db_sql.import" : "db_sql.run",
    target_type: "database",
    detail: { bytes: new TextEncoder().encode(sql).length, source },
  });
  if (auditError) throw new Error("Audit unavailable. SQL was not executed.");
  const { data, error } = await admin.rpc("admin_exec_sql", { q: withoutLeadingComments(sql) });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, result: JSON.parse(JSON.stringify(data ?? {})) as SqlResult };
}