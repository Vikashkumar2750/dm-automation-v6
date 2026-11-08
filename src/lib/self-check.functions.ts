import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CheckResult } from "@/lib/self-check";

const REQUIRED_TABLES = [
  "conversation_assignments",
  "reply_approvals",
  "team_settings",
  "api_keys",
  "outgoing_webhooks",
  "client_invoices",
  "scheduler_heartbeats",
  "growth_competitors",
  "payment_links",
  "buyer_sessions",
];

/** Read-only Super Admin self-check. Never sends messages, payments or webhooks. */
export const runSelfCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as unknown as import("@supabase/supabase-js").SupabaseClient;
    const { data: ok } = await sb.rpc("current_user_has_platform_role", { _role: "super_admin" });
    if (!ok) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient;
    const { checkPlanCatalogue, checkHeartbeats } = await import("@/lib/self-check");
    const results: CheckResult[] = [];

    // 1. Required tables
    const missing: string[] = [];
    for (const t of REQUIRED_TABLES) {
      const { error } = await admin.from(t).select("*", { head: true, count: "exact" }).limit(1);
      if (error) missing.push(t);
    }
    results.push({
      id: "tables", area: "Database", label: "Required tables exist",
      status: missing.length ? "fail" : "pass",
      detail: missing.length ? `Missing or unreadable: ${missing.join(", ")}` : `${REQUIRED_TABLES.length} tables present`,
    });

    // 2. Plan catalogue (same read as homepage/checkout)
    try {
      const { readPlatformConfig } = await import("@/lib/platform-config.server");
      const cfg = await readPlatformConfig(admin as never, { strictReads: true });
      results.push(checkPlanCatalogue(cfg.plans));
    } catch {
      results.push({ id: "plans", area: "Plans & pricing", label: "Saved plans are valid for homepage and checkout", status: "fail", detail: "Catalogue could not be read" });
    }

    // 3. Scheduler
    const hb = await admin.from("scheduler_heartbeats").select("job,last_run_at,last_status,consecutive_failures");
    results.push(hb.error
      ? { id: "scheduler", area: "Scheduler", label: "Scheduled jobs are running", status: "fail", detail: "Heartbeat table unavailable" }
      : checkHeartbeats(hb.data ?? []));

    // 4. Webhook guard: private destinations must be rejected
    const { webhookDestination } = await import("@/lib/webhook-destination.server");
    const probes = ["https://127.0.0.1/x", "https://10.0.0.5/x", "http://example.org/x", "https://localhost/x", "https://169.254.169.254/x"];
    const leaked = probes.filter((u) => { try { webhookDestination(u); return true; } catch { return false; } });
    results.push({
      id: "webhook-guard", area: "Webhooks", label: "Private/unsafe webhook addresses are blocked",
      status: leaked.length ? "fail" : "pass",
      detail: leaked.length ? `Accepted: ${leaked.join(", ")}` : `${probes.length} unsafe addresses rejected`,
    });

    // 5. Webhook delivery backlog/failures
    const wh = await admin.from("outgoing_webhooks").select("enabled,last_status,last_error");
    if (wh.error) {
      results.push({ id: "webhook-delivery", area: "Webhooks", label: "Outgoing webhook delivery", status: "fail", detail: "Webhook settings unavailable" });
    } else {
      const rows = (wh.data ?? []) as { enabled?: boolean; last_status?: number | null; last_error?: string | null }[];
      const failing = rows.filter((r) => r.enabled && (r.last_error || (r.last_status ?? 200) >= 400)).length;
      results.push({
        id: "webhook-delivery", area: "Webhooks", label: "Outgoing webhook delivery",
        status: failing || !rows.length || rows.every((r) => !r.enabled || r.last_status == null) ? "warn" : "pass",
        detail: rows.length ? `${rows.length} webhooks, ${failing} with recent failures; receiver receipt and retry are not verified by this read` : "No webhooks configured; delivery and retry not tested",
      });
    }

    // 6. Paid files stay private
    const bucket = await admin.storage.getBucket("product-files");
    results.push({
      id: "buyer-files", area: "Buyer access", label: "Paid delivery file storage is private",
      status: bucket.error ? "warn" : bucket.data?.public ? "fail" : "pass",
      detail: bucket.error ? "File storage could not be checked" : bucket.data?.public ? "Storage is PUBLIC — anyone can download" : "Private bucket confirmed; signed-in unpaid buyer denial still needs a separate access test",
    });

    // 7. Team Desk access rules
    const teamSources = await Promise.all([
      admin.from("conversation_assignments").select("conversation_id,assigned_to", { head: true }).limit(1),
      admin.from("reply_approvals").select("id,status", { head: true }).limit(1),
      admin.from("team_settings").select("organization_id,require_approval", { head: true }).limit(1),
    ]);
    const teamUnavailable = teamSources.some((source) => source.error != null);
    results.push({
      id: "team-desk", area: "Team Desk", label: "Assignment and approval storage is readable",
      status: teamUnavailable ? "fail" : "pass",
      detail: teamUnavailable ? "Assignment, approval or settings fields unavailable" : "Required fields readable; assignment and approval saves have not been exercised by this check",
    });

    return { ranAt: new Date().toISOString(), results };
  });
