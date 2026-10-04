
CREATE TABLE public.conversation_assignments (
  conversation_id uuid PRIMARY KEY REFERENCES public.conversations(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  assigned_to uuid,
  assigned_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_assignments TO authenticated;
GRANT ALL ON public.conversation_assignments TO service_role;
ALTER TABLE public.conversation_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read assignments" ON public.conversation_assignments FOR SELECT TO authenticated
  USING (public.current_user_is_org_member(organization_id));
CREATE POLICY "agents write assignments" ON public.conversation_assignments FOR ALL TO authenticated
  USING (public.current_user_has_org_role(organization_id, ARRAY['owner','admin','manager','agent']::org_role[]))
  WITH CHECK (public.current_user_has_org_role(organization_id, ARRAY['owner','admin','manager','agent']::org_role[]));

CREATE TABLE public.team_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  require_approval boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.team_settings TO authenticated;
GRANT ALL ON public.team_settings TO service_role;
ALTER TABLE public.team_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read team settings" ON public.team_settings FOR SELECT TO authenticated
  USING (public.current_user_is_org_member(organization_id));
CREATE POLICY "managers write team settings" ON public.team_settings FOR ALL TO authenticated
  USING (public.current_user_has_org_role(organization_id, ARRAY['owner','admin','manager']::org_role[]))
  WITH CHECK (public.current_user_has_org_role(organization_id, ARRAY['owner','admin','manager']::org_role[]));

CREATE TABLE public.reply_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  requested_by uuid NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reply_approvals_org_status ON public.reply_approvals(organization_id, status, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.reply_approvals TO authenticated;
GRANT ALL ON public.reply_approvals TO service_role;
ALTER TABLE public.reply_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read approvals" ON public.reply_approvals FOR SELECT TO authenticated
  USING (public.current_user_is_org_member(organization_id));
CREATE POLICY "agents request approvals" ON public.reply_approvals FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid() AND status = 'pending'
    AND public.current_user_has_org_role(organization_id, ARRAY['owner','admin','manager','agent']::org_role[]));
CREATE POLICY "managers review approvals" ON public.reply_approvals FOR UPDATE TO authenticated
  USING (public.current_user_has_org_role(organization_id, ARRAY['owner','admin','manager']::org_role[]))
  WITH CHECK (public.current_user_has_org_role(organization_id, ARRAY['owner','admin','manager']::org_role[]));

-- Server-only: API keys and outgoing webhooks (no browser grants).
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT ARRAY['read']::text[],
  created_by uuid,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.outgoing_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  url text NOT NULL,
  secret text NOT NULL,
  events text[] NOT NULL DEFAULT ARRAY['message.received']::text[],
  enabled boolean NOT NULL DEFAULT true,
  cursor_at timestamptz NOT NULL DEFAULT now(),
  last_status int,
  last_error text,
  last_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.outgoing_webhooks TO service_role;
ALTER TABLE public.outgoing_webhooks ENABLE ROW LEVEL SECURITY;
