type SqlResult = { rows?: unknown[]; affected?: number };
type SqlAdmin = {
  from: (table: string) => { insert: (record: Record<string, unknown>) => PromiseLike<{ error: unknown }> };
  rpc: (name: string, params: { q: string }) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

/** Authorize the caller before invoking this helper. Never store SQL or result values in audit rows. */
export async function executeAuditedSql(admin: SqlAdmin, userId: string, sql: string, source: "editor" | "import") {
  const { error: auditError } = await admin.from("platform_audit_log").insert({
    actor_user_id: userId,
    action: source === "import" ? "db_sql.import" : "db_sql.run",
    target_type: "database",
    detail: { bytes: new TextEncoder().encode(sql).length, source },
  });
  if (auditError) throw new Error("Audit unavailable. SQL was not executed.");
  const { data, error } = await admin.rpc("admin_exec_sql", { q: sql });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, result: JSON.parse(JSON.stringify(data ?? {})) as SqlResult };
}