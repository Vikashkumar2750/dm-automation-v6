ALTER TABLE public.revenue_products ADD COLUMN IF NOT EXISTS original_price_paise integer;
ALTER TABLE public.revenue_products ADD COLUMN IF NOT EXISTS image_path text;
ALTER TABLE public.coupon_campaigns ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'dm_unique';
ALTER TABLE public.coupon_campaigns ADD COLUMN IF NOT EXISTS store_code text;
ALTER TABLE public.delivery_pages ADD COLUMN IF NOT EXISTS coupon_campaign_id uuid;
ALTER TABLE public.delivery_pages ADD COLUMN IF NOT EXISTS otp_required boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.whatsapp_otp_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  phone_number_id text NOT NULL,
  access_token text NOT NULL,
  template_name text NOT NULL,
  template_language text NOT NULL DEFAULT 'en',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.whatsapp_otp_settings TO service_role;
ALTER TABLE public.whatsapp_otp_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.lead_otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  page_ref text NOT NULL,
  phone text NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.lead_otp_codes TO service_role;
ALTER TABLE public.lead_otp_codes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS lead_otp_codes_lookup ON public.lead_otp_codes (organization_id, page_ref, phone, created_at DESC);