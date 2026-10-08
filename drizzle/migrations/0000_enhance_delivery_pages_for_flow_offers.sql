ALTER TABLE public.delivery_pages
  ADD COLUMN IF NOT EXISTS image_path text,
  ADD COLUMN IF NOT EXISTS show_image boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS image_alt text,
  ADD COLUMN IF NOT EXISTS countdown_at timestamptz,
  ADD COLUMN IF NOT EXISTS expiry_action text NOT NULL DEFAULT 'disable_cta',
  ADD COLUMN IF NOT EXISTS expiry_message text,
  ADD COLUMN IF NOT EXISTS form_config jsonb NOT NULL DEFAULT '{"mode":"none","fields":[]}'::jsonb;

ALTER TABLE public.delivery_pages
  ADD CONSTRAINT delivery_pages_expiry_action_check
  CHECK (expiry_action IN ('disable_cta', 'hide_cta')) NOT VALID;

ALTER TABLE public.payment_links
  ADD COLUMN IF NOT EXISTS delivery_page_id uuid REFERENCES public.delivery_pages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS offer_token uuid UNIQUE;

CREATE INDEX IF NOT EXISTS payment_links_offer_token_idx ON public.payment_links(offer_token) WHERE offer_token IS NOT NULL;

CREATE POLICY "delivery page image members read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'delivery-page-images'
  AND app_private.is_org_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY "delivery page image writers upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'delivery-page-images'
  AND app_private.has_org_role(((storage.foldername(name))[1])::uuid, auth.uid(), ARRAY['owner'::public.org_role,'admin'::public.org_role,'manager'::public.org_role])
);

CREATE POLICY "delivery page image writers update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'delivery-page-images'
  AND app_private.has_org_role(((storage.foldername(name))[1])::uuid, auth.uid(), ARRAY['owner'::public.org_role,'admin'::public.org_role,'manager'::public.org_role])
)
WITH CHECK (
  bucket_id = 'delivery-page-images'
  AND app_private.has_org_role(((storage.foldername(name))[1])::uuid, auth.uid(), ARRAY['owner'::public.org_role,'admin'::public.org_role,'manager'::public.org_role])
);

CREATE POLICY "delivery page image writers delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'delivery-page-images'
  AND app_private.has_org_role(((storage.foldername(name))[1])::uuid, auth.uid(), ARRAY['owner'::public.org_role,'admin'::public.org_role,'manager'::public.org_role])
);