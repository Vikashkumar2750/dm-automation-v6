ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS bot_paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS bot_paused_until timestamptz,
  ADD COLUMN IF NOT EXISTS bot_paused_by uuid,
  ADD COLUMN IF NOT EXISTS bot_paused_reason text;

ALTER TABLE public.automation_settings
  ADD COLUMN IF NOT EXISTS takeover_minutes integer NOT NULL DEFAULT 60
  CHECK (takeover_minutes BETWEEN 5 AND 10080);

CREATE TABLE IF NOT EXISTS public.scheduler_heartbeats (
  job text PRIMARY KEY,
  last_run_at timestamptz NOT NULL DEFAULT now(),
  last_ok_at timestamptz,
  last_status integer,
  last_duration_ms integer,
  consecutive_failures integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.scheduler_heartbeats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.scheduler_heartbeats FROM anon, authenticated;
GRANT ALL ON public.scheduler_heartbeats TO service_role;