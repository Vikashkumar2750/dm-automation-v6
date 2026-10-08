ALTER TABLE public.delivery_pages
  ADD COLUMN IF NOT EXISTS price_original_paise integer,
  ADD COLUMN IF NOT EXISTS price_offer_paise integer,
  ADD COLUMN IF NOT EXISTS discount_label text,
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS coupon_note text,
  ADD COLUMN IF NOT EXISTS show_price boolean NOT NULL DEFAULT false;

CREATE TABLE public.delivery_page_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  delivery_page_id uuid NOT NULL REFERENCES public.delivery_pages(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX delivery_page_leads_page_idx ON public.delivery_page_leads (delivery_page_id, created_at DESC);
GRANT SELECT ON public.delivery_page_leads TO authenticated;
GRANT ALL ON public.delivery_page_leads TO service_role;
ALTER TABLE public.delivery_page_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read page leads" ON public.delivery_page_leads FOR SELECT TO authenticated
  USING (public.current_user_is_org_member(organization_id));