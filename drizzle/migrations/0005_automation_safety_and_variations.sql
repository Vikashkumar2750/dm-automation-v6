-- Response variations on rules (additive)
ALTER TABLE public.automation_rules
  ADD COLUMN IF NOT EXISTS response_variations text[] NOT NULL DEFAULT '{}'::text[];

-- Org-level safety settings
CREATE TABLE IF NOT EXISTS public.automation_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  is_paused boolean NOT NULL DEFAULT false,
  blocked_keywords text[] NOT NULL DEFAULT '{}'::text[],
  opt_out_keywords text[] NOT NULL DEFAULT ARRAY['stop','unsubscribe','stop messaging']::text[],
  per_contact_daily_limit integer NOT NULL DEFAULT 5,
  quiet_hours_enabled boolean NOT NULL DEFAULT false,
  quiet_hours_start integer NOT NULL DEFAULT 22,
  quiet_hours_end integer NOT NULL DEFAULT 7,
  timezone_offset_minutes integer NOT NULL DEFAULT 330,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_settings TO authenticated;
GRANT ALL ON public.automation_settings TO service_role;
ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automation settings select member" ON public.automation_settings
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.has_platform_role(auth.uid(), 'super_admin'));
CREATE POLICY "automation settings insert manager" ON public.automation_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','manager']::org_role[]));
CREATE POLICY "automation settings update manager" ON public.automation_settings
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','manager']::org_role[]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','manager']::org_role[]));

CREATE TRIGGER automation_settings_updated_at BEFORE UPDATE ON public.automation_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Contact opt-outs
CREATE TABLE IF NOT EXISTS public.automation_opt_outs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  platform social_platform NOT NULL,
  external_user_id text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, platform, external_user_id)
);

GRANT SELECT, INSERT, DELETE ON public.automation_opt_outs TO authenticated;
GRANT ALL ON public.automation_opt_outs TO service_role;
ALTER TABLE public.automation_opt_outs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "opt outs select member" ON public.automation_opt_outs
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.has_platform_role(auth.uid(), 'super_admin'));
CREATE POLICY "opt outs insert manager" ON public.automation_opt_outs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','manager']::org_role[]));
CREATE POLICY "opt outs delete manager" ON public.automation_opt_outs
  FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','manager']::org_role[]));

CREATE INDEX IF NOT EXISTS automation_runs_contact_idx ON public.automation_runs (organization_id, conversation_id, created_at DESC);
