-- Apply only to the affected live Railway app database.
-- Compatible with Super Admin Run SQL (no BEGIN/COMMIT).
-- Does not start jobs, retry posts, change secrets, or fabricate heartbeats.
DO $repair$
BEGIN
  CREATE TABLE IF NOT EXISTS public.scheduler_heartbeats (
    job text PRIMARY KEY,
    last_run_at timestamptz NOT NULL DEFAULT now(),
    last_ok_at timestamptz,
    last_status integer,
    last_duration_ms integer,
    consecutive_failures integer NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  GRANT ALL ON public.scheduler_heartbeats TO service_role;
  ALTER TABLE public.scheduler_heartbeats ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.scheduler_heartbeats FROM PUBLIC, anon, authenticated;
END
$repair$;