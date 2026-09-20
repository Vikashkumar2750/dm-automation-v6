CREATE TABLE public.platform_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  global_send_paused boolean NOT NULL DEFAULT false,
  incident_banner text,
  feature_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admins read platform settings" ON public.platform_settings
  FOR SELECT TO authenticated
  USING (public.has_platform_role(auth.uid(), 'super_admin'));

INSERT INTO public.platform_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

CREATE TABLE public.platform_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  action text NOT NULL,
  target_type text,
  target_id text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX platform_audit_log_created_at_idx ON public.platform_audit_log (created_at DESC);

GRANT SELECT ON public.platform_audit_log TO authenticated;
GRANT ALL ON public.platform_audit_log TO service_role;
ALTER TABLE public.platform_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admins read audit log" ON public.platform_audit_log
  FOR SELECT TO authenticated
  USING (public.has_platform_role(auth.uid(), 'super_admin'));