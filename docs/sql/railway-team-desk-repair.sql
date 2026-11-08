-- Run on the LIVE AutoDM database. One DO statement: compatible with Run SQL.
-- Does not delete existing rows, send messages, or create keys/webhooks.
DO $repair$
BEGIN
  CREATE TABLE IF NOT EXISTS public.conversation_assignments (
    conversation_id uuid PRIMARY KEY REFERENCES public.conversations(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    assigned_to uuid, assigned_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
  );
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_assignments TO authenticated;
  GRANT ALL ON public.conversation_assignments TO service_role;
  REVOKE ALL ON public.conversation_assignments FROM PUBLIC, anon;
  ALTER TABLE public.conversation_assignments ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "members read assignments" ON public.conversation_assignments;
  CREATE POLICY "members read assignments" ON public.conversation_assignments FOR SELECT TO authenticated
    USING (public.current_user_is_org_member(organization_id));
  DROP POLICY IF EXISTS "agents write assignments" ON public.conversation_assignments;
  CREATE POLICY "agents write assignments" ON public.conversation_assignments FOR ALL TO authenticated
    USING (public.current_user_has_org_role(organization_id, ARRAY['owner','admin','manager','agent']::public.org_role[]))
    WITH CHECK (public.current_user_has_org_role(organization_id, ARRAY['owner','admin','manager','agent']::public.org_role[])
      AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.organization_id = conversation_assignments.organization_id));

  CREATE TABLE IF NOT EXISTS public.team_settings (
    organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
    require_approval boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now()
  );
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_settings TO authenticated;
  GRANT ALL ON public.team_settings TO service_role;
  REVOKE ALL ON public.team_settings FROM PUBLIC, anon;
  ALTER TABLE public.team_settings ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "members read team settings" ON public.team_settings;
  CREATE POLICY "members read team settings" ON public.team_settings FOR SELECT TO authenticated
    USING (public.current_user_is_org_member(organization_id));
  DROP POLICY IF EXISTS "managers write team settings" ON public.team_settings;
  CREATE POLICY "managers write team settings" ON public.team_settings FOR ALL TO authenticated
    USING (public.current_user_has_org_role(organization_id, ARRAY['owner','admin','manager']::public.org_role[]))
    WITH CHECK (public.current_user_has_org_role(organization_id, ARRAY['owner','admin','manager']::public.org_role[]));

  CREATE TABLE IF NOT EXISTS public.reply_approvals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    requested_by uuid NOT NULL, reviewed_by uuid, reviewed_at timestamptz, note text,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  GRANT SELECT, INSERT, UPDATE ON public.reply_approvals TO authenticated;
  GRANT ALL ON public.reply_approvals TO service_role;
  REVOKE ALL ON public.reply_approvals FROM PUBLIC, anon;
  ALTER TABLE public.reply_approvals ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "members read approvals" ON public.reply_approvals;
  CREATE POLICY "members read approvals" ON public.reply_approvals FOR SELECT TO authenticated
    USING (public.current_user_is_org_member(organization_id));
  DROP POLICY IF EXISTS "agents request approvals" ON public.reply_approvals;
  CREATE POLICY "agents request approvals" ON public.reply_approvals FOR INSERT TO authenticated
    WITH CHECK (requested_by = auth.uid() AND status = 'pending'
      AND public.current_user_has_org_role(organization_id, ARRAY['owner','admin','manager','agent']::public.org_role[])
      AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.organization_id = reply_approvals.organization_id));
  DROP POLICY IF EXISTS "managers review approvals" ON public.reply_approvals;
  CREATE POLICY "managers review approvals" ON public.reply_approvals FOR UPDATE TO authenticated
    USING (public.current_user_has_org_role(organization_id, ARRAY['owner','admin','manager']::public.org_role[]))
    WITH CHECK (public.current_user_has_org_role(organization_id, ARRAY['owner','admin','manager']::public.org_role[])
      AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.organization_id = reply_approvals.organization_id));
  CREATE INDEX IF NOT EXISTS reply_approvals_org_status_idx ON public.reply_approvals(organization_id, status, created_at DESC);

  CREATE TABLE IF NOT EXISTS public.api_keys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name text NOT NULL, prefix text NOT NULL, key_hash text NOT NULL UNIQUE,
    scopes text[] NOT NULL DEFAULT ARRAY['read'], created_by uuid, last_used_at timestamptz,
    revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
  );
  GRANT ALL ON public.api_keys TO service_role;
  REVOKE ALL ON public.api_keys FROM PUBLIC, anon, authenticated;
  ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

  CREATE TABLE IF NOT EXISTS public.outgoing_webhooks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    url text NOT NULL, secret text NOT NULL, events text[] NOT NULL DEFAULT ARRAY['message.received'],
    enabled boolean NOT NULL DEFAULT true, cursor_at timestamptz NOT NULL DEFAULT now(),
    last_status integer, last_error text, last_sent_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
  );
  GRANT ALL ON public.outgoing_webhooks TO service_role;
  REVOKE ALL ON public.outgoing_webhooks FROM PUBLIC, anon, authenticated;
  ALTER TABLE public.outgoing_webhooks ENABLE ROW LEVEL SECURITY;

  IF to_regprocedure('public.log_org_audit()') IS NOT NULL AND to_regclass('public.org_audit_log') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS org_audit_trg ON public.conversation_assignments;
    CREATE TRIGGER org_audit_trg AFTER INSERT OR UPDATE OR DELETE ON public.conversation_assignments FOR EACH ROW EXECUTE FUNCTION public.log_org_audit();
    DROP TRIGGER IF EXISTS org_audit_trg ON public.team_settings;
    CREATE TRIGGER org_audit_trg AFTER INSERT OR UPDATE OR DELETE ON public.team_settings FOR EACH ROW EXECUTE FUNCTION public.log_org_audit();
    DROP TRIGGER IF EXISTS org_audit_trg ON public.reply_approvals;
    CREATE TRIGGER org_audit_trg AFTER INSERT OR UPDATE OR DELETE ON public.reply_approvals FOR EACH ROW EXECUTE FUNCTION public.log_org_audit();
    DROP TRIGGER IF EXISTS org_audit_trg ON public.api_keys;
    CREATE TRIGGER org_audit_trg AFTER INSERT OR UPDATE OR DELETE ON public.api_keys FOR EACH ROW EXECUTE FUNCTION public.log_org_audit();
    DROP TRIGGER IF EXISTS org_audit_trg ON public.outgoing_webhooks;
    CREATE TRIGGER org_audit_trg AFTER INSERT OR UPDATE OR DELETE ON public.outgoing_webhooks FOR EACH ROW EXECUTE FUNCTION public.log_org_audit();
  END IF;
  NOTIFY pgrst, 'reload schema';
END
$repair$;