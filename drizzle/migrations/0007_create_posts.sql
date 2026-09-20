CREATE TYPE public.post_status AS ENUM ('draft','scheduled','publishing','published','failed');

CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  social_account_id uuid REFERENCES public.social_accounts(id) ON DELETE SET NULL,
  platform public.social_platform NOT NULL,
  caption text NOT NULL DEFAULT '',
  media_url text,
  media_type text NOT NULL DEFAULT 'image',
  scheduled_at timestamptz,
  status public.post_status NOT NULL DEFAULT 'draft',
  external_post_id text,
  permalink text,
  error text,
  published_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "posts select members" ON public.posts FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.has_platform_role(auth.uid(), 'super_admin'));

CREATE POLICY "posts insert managers" ON public.posts FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','manager']::org_role[]));

CREATE POLICY "posts update managers" ON public.posts FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','manager']::org_role[]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','manager']::org_role[]));

CREATE POLICY "posts delete managers" ON public.posts FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','manager']::org_role[]));

CREATE INDEX posts_org_scheduled_idx ON public.posts (organization_id, scheduled_at DESC);
CREATE INDEX posts_due_idx ON public.posts (status, scheduled_at) WHERE status = 'scheduled';

CREATE TRIGGER posts_set_updated_at BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();