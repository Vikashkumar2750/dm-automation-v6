CREATE TABLE public.nudge_settings (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  delay_minutes INT NOT NULL DEFAULT 120 CHECK (delay_minutes BETWEEN 15 AND 1200),
  text TEXT NOT NULL DEFAULT 'Hi! Just checking in — can I help you with anything?',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nudge_settings TO authenticated;
GRANT ALL ON public.nudge_settings TO service_role;
ALTER TABLE public.nudge_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage nudge settings" ON public.nudge_settings FOR ALL TO authenticated
  USING (public.current_user_is_org_member(organization_id)) WITH CHECK (public.current_user_is_org_member(organization_id));

CREATE TABLE public.conversation_nudge_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL UNIQUE REFERENCES public.conversations(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.conversation_nudge_log TO authenticated;
GRANT ALL ON public.conversation_nudge_log TO service_role;
ALTER TABLE public.conversation_nudge_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view nudge log" ON public.conversation_nudge_log FOR SELECT TO authenticated
  USING (public.current_user_is_org_member(organization_id));

CREATE TABLE public.broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  filter JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sending','done','failed')),
  sent_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.broadcasts TO authenticated;
GRANT ALL ON public.broadcasts TO service_role;
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage broadcasts" ON public.broadcasts FOR ALL TO authenticated
  USING (public.current_user_is_org_member(organization_id)) WITH CHECK (public.current_user_is_org_member(organization_id));

CREATE TABLE public.crm_sync_settings (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  webhook_url TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_sync_settings TO authenticated;
GRANT ALL ON public.crm_sync_settings TO service_role;
ALTER TABLE public.crm_sync_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage sync settings" ON public.crm_sync_settings FOR ALL TO authenticated
  USING (public.current_user_is_org_member(organization_id)) WITH CHECK (public.current_user_is_org_member(organization_id));