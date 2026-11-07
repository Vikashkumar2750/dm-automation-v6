-- For the independently hosted live backend only, after a backup.
-- The current preview backend already has this table. Do not reset either backend.
BEGIN;
CREATE TABLE IF NOT EXISTS public.growth_competitors (
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
DROP POLICY IF EXISTS "Members read competitors" ON public.growth_competitors;
CREATE POLICY "Members read competitors" ON public.growth_competitors
  FOR SELECT TO authenticated USING (public.current_user_has_org_role(organization_id,
    ARRAY['owner','admin','manager','agent','viewer']::public.org_role[]));
DROP POLICY IF EXISTS "Managers insert competitors" ON public.growth_competitors;
CREATE POLICY "Managers insert competitors" ON public.growth_competitors
  FOR INSERT TO authenticated WITH CHECK (public.current_user_has_org_role(organization_id,
    ARRAY['owner','admin','manager']::public.org_role[]));
DROP POLICY IF EXISTS "Managers update competitors" ON public.growth_competitors;
CREATE POLICY "Managers update competitors" ON public.growth_competitors
  FOR UPDATE TO authenticated
  USING (public.current_user_has_org_role(organization_id, ARRAY['owner','admin','manager']::public.org_role[]))
  WITH CHECK (public.current_user_has_org_role(organization_id, ARRAY['owner','admin','manager']::public.org_role[]));
DROP POLICY IF EXISTS "Managers delete competitors" ON public.growth_competitors;
CREATE POLICY "Managers delete competitors" ON public.growth_competitors
  FOR DELETE TO authenticated USING (public.current_user_has_org_role(organization_id,
    ARRAY['owner','admin','manager']::public.org_role[]));
CREATE INDEX IF NOT EXISTS growth_competitors_org_idx ON public.growth_competitors (organization_id);
NOTIFY pgrst, 'reload schema';
COMMIT;