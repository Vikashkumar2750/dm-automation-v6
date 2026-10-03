CREATE TABLE public.contact_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  platform text NOT NULL,
  external_user_id text NOT NULL,
  email text,
  phone text,
  notes text,
  custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, platform, external_user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_profiles TO authenticated;
GRANT ALL ON public.contact_profiles TO service_role;
ALTER TABLE public.contact_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view contact profiles" ON public.contact_profiles FOR SELECT TO authenticated USING (public.current_user_is_org_member(organization_id));
CREATE POLICY "Agents edit contact profiles" ON public.contact_profiles FOR ALL TO authenticated
  USING (public.current_user_has_org_role(organization_id, ARRAY['owner','admin','manager','agent']::org_role[]))
  WITH CHECK (public.current_user_has_org_role(organization_id, ARRAY['owner','admin','manager','agent']::org_role[]));

CREATE TABLE public.contact_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_segments TO authenticated;
GRANT ALL ON public.contact_segments TO service_role;
ALTER TABLE public.contact_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view segments" ON public.contact_segments FOR SELECT TO authenticated USING (public.current_user_is_org_member(organization_id));
CREATE POLICY "Agents edit segments" ON public.contact_segments FOR ALL TO authenticated
  USING (public.current_user_has_org_role(organization_id, ARRAY['owner','admin','manager','agent']::org_role[]))
  WITH CHECK (public.current_user_has_org_role(organization_id, ARRAY['owner','admin','manager','agent']::org_role[]));

GRANT SELECT, INSERT, DELETE ON public.contact_tags TO authenticated;
GRANT ALL ON public.contact_tags TO service_role;
CREATE POLICY "Agents edit contact tags" ON public.contact_tags FOR ALL TO authenticated
  USING (public.current_user_has_org_role(organization_id, ARRAY['owner','admin','manager','agent']::org_role[]))
  WITH CHECK (public.current_user_has_org_role(organization_id, ARRAY['owner','admin','manager','agent']::org_role[]));