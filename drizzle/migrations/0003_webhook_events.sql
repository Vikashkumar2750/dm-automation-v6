CREATE TYPE public.webhook_status AS ENUM ('received','processed','failed','ignored');

CREATE TABLE public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  platform public.social_platform,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  social_account_id uuid REFERENCES public.social_accounts(id) ON DELETE SET NULL,
  external_account_id text,
  event_type text NOT NULL DEFAULT 'unknown',
  dedupe_key text UNIQUE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  signature_valid boolean NOT NULL DEFAULT false,
  status public.webhook_status NOT NULL DEFAULT 'received',
  error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX webhook_events_org_received_idx ON public.webhook_events (organization_id, received_at DESC);
CREATE INDEX webhook_events_status_idx ON public.webhook_events (status);

GRANT SELECT ON public.webhook_events TO authenticated;
GRANT ALL ON public.webhook_events TO service_role;

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read webhook events"
ON public.webhook_events FOR SELECT TO authenticated
USING (
  (organization_id IS NOT NULL AND public.is_org_member(organization_id, auth.uid()))
  OR public.has_platform_role(auth.uid(), 'super_admin')
);

CREATE POLICY "Service role manages webhook events"
ON public.webhook_events FOR ALL TO service_role
USING (true) WITH CHECK (true);