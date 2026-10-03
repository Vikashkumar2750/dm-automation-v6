CREATE TABLE public.revenue_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL, description text, price_paise integer NOT NULL CHECK (price_paise >= 100),
  currency text NOT NULL DEFAULT 'INR', manual_url text, active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revenue_products TO authenticated;
GRANT ALL ON public.revenue_products TO service_role;
ALTER TABLE public.revenue_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage products" ON public.revenue_products FOR ALL TO authenticated
  USING (public.current_user_is_org_member(organization_id)) WITH CHECK (public.current_user_is_org_member(organization_id));

CREATE TABLE public.delivery_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{3,60}$'),
  title text NOT NULL, body text, button_label text, button_url text,
  product_id uuid REFERENCES public.revenue_products(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true, views integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_pages TO authenticated;
GRANT ALL ON public.delivery_pages TO service_role;
ALTER TABLE public.delivery_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage pages" ON public.delivery_pages FOR ALL TO authenticated
  USING (public.current_user_is_org_member(organization_id)) WITH CHECK (public.current_user_is_org_member(organization_id));

CREATE TABLE public.coupon_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL, prefix text NOT NULL CHECK (prefix ~ '^[A-Z0-9]{2,12}$'),
  discount_label text NOT NULL, max_codes integer NOT NULL DEFAULT 500, expires_at timestamptz,
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupon_campaigns TO authenticated;
GRANT ALL ON public.coupon_campaigns TO service_role;
ALTER TABLE public.coupon_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage coupons" ON public.coupon_campaigns FOR ALL TO authenticated
  USING (public.current_user_is_org_member(organization_id)) WITH CHECK (public.current_user_is_org_member(organization_id));

CREATE TABLE public.coupon_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.coupon_campaigns(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE, platform text NOT NULL, external_user_id text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, platform, external_user_id)
);
GRANT SELECT ON public.coupon_codes TO authenticated;
GRANT ALL ON public.coupon_codes TO service_role;
ALTER TABLE public.coupon_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view coupon codes" ON public.coupon_codes FOR SELECT TO authenticated USING (public.current_user_is_org_member(organization_id));

CREATE TABLE public.payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.revenue_products(id) ON DELETE SET NULL,
  conversation_id uuid, social_account_id uuid,
  platform text NOT NULL, external_user_id text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('razorpay','manual')), provider_link_id text UNIQUE,
  url text NOT NULL, amount_paise integer NOT NULL,
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created','paid','expired')),
  nudged_at timestamptz, paid_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_links TO authenticated;
GRANT ALL ON public.payment_links TO service_role;
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view payment links" ON public.payment_links FOR SELECT TO authenticated USING (public.current_user_is_org_member(organization_id));
CREATE INDEX payment_links_nudge_idx ON public.payment_links (status, nudged_at, created_at);

CREATE TABLE public.revenue_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('page_view','page_click','payment_link','paid','coupon','nudge')),
  platform text, external_user_id text, ref_id uuid, amount_paise integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.revenue_events TO authenticated;
GRANT ALL ON public.revenue_events TO service_role;
ALTER TABLE public.revenue_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view revenue events" ON public.revenue_events FOR SELECT TO authenticated USING (public.current_user_is_org_member(organization_id));
CREATE INDEX revenue_events_org_idx ON public.revenue_events (organization_id, created_at);

CREATE TABLE public.revenue_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  nudge_enabled boolean NOT NULL DEFAULT false,
  nudge_delay_minutes integer NOT NULL DEFAULT 120 CHECK (nudge_delay_minutes BETWEEN 15 AND 1200),
  nudge_text text NOT NULL DEFAULT 'Hi! Your payment link is still waiting. Need any help completing it?',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.revenue_settings TO authenticated;
GRANT ALL ON public.revenue_settings TO service_role;
ALTER TABLE public.revenue_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage revenue settings" ON public.revenue_settings FOR ALL TO authenticated
  USING (public.current_user_is_org_member(organization_id)) WITH CHECK (public.current_user_is_org_member(organization_id));

-- Payment keys: server-only. No grants to anon/authenticated, no policies.
CREATE TABLE public.payment_credentials (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  razorpay_key_id text NOT NULL, razorpay_key_secret text NOT NULL, webhook_secret text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.payment_credentials TO service_role;
ALTER TABLE public.payment_credentials ENABLE ROW LEVEL SECURITY;