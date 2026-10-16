ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS dm_link_in_text boolean NOT NULL DEFAULT false;
