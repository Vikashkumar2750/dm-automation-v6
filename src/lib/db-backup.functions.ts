import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

async function adminFor(context: Ctx) {
  const { data, error } = await context.supabase.rpc("current_user_has_platform_role", { _role: "super_admin" });
  if (error || !data) throw new Error("forbidden");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/** Runs SQL (queries return up to 500 rows; scripts run as one transaction). Super Admin only, audited. */
export const runAdminSql = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sql: z.string().min(1).max(20_000_000), source: z.enum(["editor", "import"]) }).parse(d))
  .handler(async ({ context, data }) => {
    const c = context as Ctx;
    const admin = await adminFor(c);
    const { executeAuditedSql } = await import("./db-admin-sql.server");
    return executeAuditedSql(admin, c.userId, data.sql, data.source);
  });
