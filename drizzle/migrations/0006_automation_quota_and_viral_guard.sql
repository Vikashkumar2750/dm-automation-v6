ALTER TABLE public.automation_settings
  ADD COLUMN IF NOT EXISTS hourly_send_limit integer NOT NULL DEFAULT 120,
  ADD COLUMN IF NOT EXISTS daily_send_limit integer NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS viral_guard_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS viral_threshold_per_minute integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS viral_cooldown_minutes integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS auto_paused_until timestamptz,
  ADD COLUMN IF NOT EXISTS auto_pause_reason text;

CREATE INDEX IF NOT EXISTS automation_runs_org_status_created_idx
  ON public.automation_runs (organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS messages_conversation_sent_at_idx
  ON public.messages (conversation_id, sent_at DESC);