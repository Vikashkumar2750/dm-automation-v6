CREATE TABLE public.client_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_label text NOT NULL,
  amount_inr numeric(12,2) NOT NULL CHECK (amount_inr > 0),
  status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','paid','void')),
  payment_url text,
  notes text,
  paid_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_invoices TO authenticated;
GRANT ALL ON public.client_invoices TO service_role;
ALTER TABLE public.client_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reviewers manage client invoices" ON public.client_invoices FOR ALL TO authenticated
  USING (public.current_user_has_org_role(organization_id, ARRAY['owner','admin','manager']::public.org_role[]))
  WITH CHECK (public.current_user_has_org_role(organization_id, ARRAY['owner','admin','manager']::public.org_role[]));
CREATE INDEX client_invoices_org_idx ON public.client_invoices(organization_id, created_at DESC);