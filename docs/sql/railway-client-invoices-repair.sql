-- Run on the database used by autodm.techaasvik.com, not another backend.
-- Additive and repeatable: existing invoice rows are preserved.
BEGIN;
CREATE TABLE IF NOT EXISTS public.client_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_label text NOT NULL,
  amount_inr numeric(12,2) NOT NULL CHECK (amount_inr > 0),
  status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'void')),
  payment_url text,
  notes text,
  paid_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_invoices TO authenticated;
GRANT ALL ON public.client_invoices TO service_role;
REVOKE ALL ON public.client_invoices FROM PUBLIC, anon;
ALTER TABLE public.client_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reviewers manage client invoices" ON public.client_invoices;
CREATE POLICY "Reviewers manage client invoices" ON public.client_invoices
  FOR ALL TO authenticated
  USING (public.current_user_has_org_role(organization_id, ARRAY['owner','admin','manager']::public.org_role[]))
  WITH CHECK (
    public.current_user_has_org_role(organization_id, ARRAY['owner','admin','manager']::public.org_role[])
    AND public.current_user_is_org_member(client_organization_id)
  );
CREATE INDEX IF NOT EXISTS client_invoices_org_idx
  ON public.client_invoices (organization_id, created_at DESC);
DO $$
BEGIN
  IF to_regprocedure('public.log_org_audit()') IS NOT NULL
     AND to_regclass('public.org_audit_log') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS org_audit_trg ON public.client_invoices;
    CREATE TRIGGER org_audit_trg AFTER INSERT OR UPDATE OR DELETE
      ON public.client_invoices FOR EACH ROW EXECUTE FUNCTION public.log_org_audit();
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;

-- Read-only confirmation of Team Desk prerequisites.
SELECT name, to_regclass('public.' || name) AS installed_table
FROM (VALUES ('client_invoices'), ('conversation_assignments'), ('team_settings'),
             ('reply_approvals'), ('api_keys'), ('outgoing_webhooks')) AS t(name);