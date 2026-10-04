CREATE TABLE public.growth_competitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  handle text,
  platform text NOT NULL DEFAULT 'instagram',
  followers integer NOT NULL DEFAULT 0,
  posts_per_week numeric NOT NULL DEFAULT 0,
  avg_comments numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.growth_competitors TO authenticated;
GRANT ALL ON public.growth_competitors TO service_role;
ALTER TABLE public.growth_competitors ENABLE ROW LEVEL SECURITY;
CREATE INDEX growth_competitors_org_idx ON public.growth_competitors(organization_id);
CREATE POLICY "Members read competitors" ON public.growth_competitors FOR SELECT TO authenticated
  USING (current_user_has_org_role(organization_id, ARRAY['owner','admin','manager','agent','viewer']::org_role[]));
CREATE POLICY "Managers insert competitors" ON public.growth_competitors FOR INSERT TO authenticated
  WITH CHECK (current_user_has_org_role(organization_id, ARRAY['owner','admin','manager']::org_role[]));
CREATE POLICY "Managers update competitors" ON public.growth_competitors FOR UPDATE TO authenticated
  USING (current_user_has_org_role(organization_id, ARRAY['owner','admin','manager']::org_role[]));
CREATE POLICY "Managers delete competitors" ON public.growth_competitors FOR DELETE TO authenticated
  USING (current_user_has_org_role(organization_id, ARRAY['owner','admin','manager']::org_role[]));