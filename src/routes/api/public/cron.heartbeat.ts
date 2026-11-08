import { createFileRoute } from "@tanstack/react-router";

/**
 * P2 scheduler heartbeat. POST: the scheduler reports each job's result after a tick.
 * GET: health assessment (stale / failing / slow / missing). Cron-secret protected both ways.
 */
export const Route = createFileRoute("/api/public/cron/heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { cronAuthFailure } = await import("@/lib/cron-secret.server");
        const denied = cronAuthFailure(request, "/api/public/cron/heartbeat");
        if (denied) return denied;
        const { SCHEDULER_JOBS, nextFailureStreak } = await import("@/lib/scheduler-health");
        const body = (await request.json().catch(() => null)) as { results?: { job: string; status: number; ms: number }[] } | null;
        const results = (body?.results ?? []).filter((r) => (SCHEDULER_JOBS as readonly string[]).includes(r.job));
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: prev, error: readError } = await supabaseAdmin.from("scheduler_heartbeats").select("job, consecutive_failures");
        if (readError) return Response.json({ error: "Scheduler records unavailable" }, { status: 503 });
        const streaks = new Map((prev ?? []).map((p) => [p.job, p.consecutive_failures]));
        const now = new Date().toISOString();
        const rows = results.map((r) => {
          const ok = r.status === 200;
          return {
            job: r.job, last_run_at: now, last_status: Math.round(r.status) || 0,
            last_duration_ms: Math.max(0, Math.round(r.ms) || 0),
            consecutive_failures: nextFailureStreak(streaks.get(r.job) ?? 0, ok),
            ...(ok ? { last_ok_at: now } : {}), updated_at: now,
          };
        });
        if (rows.length) {
          const { error } = await supabaseAdmin.from("scheduler_heartbeats").upsert(rows, { onConflict: "job" });
          if (error) return Response.json({ error: "Scheduler heartbeat was not recorded" }, { status: 503 });
        }
        return Response.json({ recorded: rows.length });
      },
      GET: async ({ request }) => {
        const { cronAuthFailure } = await import("@/lib/cron-secret.server");
        const denied = cronAuthFailure(request, "/api/public/cron/heartbeat");
        if (denied) return denied;
        const { assessScheduler } = await import("@/lib/scheduler-health");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.from("scheduler_heartbeats").select("job, last_run_at, last_status, last_duration_ms, consecutive_failures");
        if (error) return Response.json({ error: "Scheduler records unavailable" }, { status: 503 });
        const health = assessScheduler(data ?? [], Date.now());
        return Response.json(health, { status: health.healthy ? 200 : 503 });
      },
    },
  },
});
