CREATE TABLE IF NOT EXISTS public.buyer_login_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  email text NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS buyer_login_codes_lookup ON public.buyer_login_codes (organization_id, email, created_at DESC);
GRANT ALL ON public.buyer_login_codes TO service_role;
ALTER TABLE public.buyer_login_codes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.buyer_sessions (
  token_hash text PRIMARY KEY,
  organization_id uuid NOT NULL,
  email text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.buyer_sessions TO service_role;
ALTER TABLE public.buyer_sessions ENABLE ROW LEVEL SECURITY;