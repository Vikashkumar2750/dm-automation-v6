import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rejectLegacyDatabaseOperation } from "./db-backup.server";

// Retain retired endpoint names so stale clients cannot execute privileged SQL
// or export credentials. No admin client is loaded and no database RPC is called.
const retiredOperation = () => createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => rejectLegacyDatabaseOperation());

export const listBackups = retiredOperation();
export const createBackup = retiredOperation();
export const downloadBackup = retiredOperation();
export const deleteBackup = retiredOperation();
export const saveBackupSchedule = retiredOperation();
export const runAdminSql = retiredOperation();
