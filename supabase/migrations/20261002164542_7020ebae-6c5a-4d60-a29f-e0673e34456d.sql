CREATE TABLE public.flow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  flow_id text NOT NULL,
  flow_name text NOT NULL DEFAULT '',
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  next_step int NOT NULL DEFAULT 0,
  resume_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'waiting',
  detail text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX flow_runs_due_idx ON public.flow_runs (status, resume_at);
GRANT SELECT ON public.flow_runs TO authenticated;
GRANT ALL ON public.flow_runs TO service_role;
ALTER TABLE public.flow_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view flow runs" ON public.flow_runs FOR SELECT TO authenticated
  USING (public.current_user_is_org_member(organization_id));

CREATE TABLE public.contact_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  platform text NOT NULL,
  external_user_id text NOT NULL,
  tag text NOT NULL,
  source text NOT NULL DEFAULT 'flow',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, platform, external_user_id, tag)
);
GRANT SELECT ON public.contact_tags TO authenticated;
GRANT ALL ON public.contact_tags TO service_role;
ALTER TABLE public.contact_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view contact tags" ON public.contact_tags FOR SELECT TO authenticated
  USING (public.current_user_is_org_member(organization_id));