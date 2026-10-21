CREATE TABLE public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  user_id uuid,
  bucket text NOT NULL,
  path text NOT NULL,
  kind text NOT NULL DEFAULT 'image',
  original_name text,
  original_type text,
  original_bytes bigint NOT NULL DEFAULT 0,
  optimized_type text,
  optimized_bytes bigint NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'upload',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.media_assets TO authenticated;
GRANT ALL ON public.media_assets TO service_role;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read own workspace media" ON public.media_assets FOR SELECT TO authenticated
  USING (public.current_user_is_org_member(organization_id) OR public.current_user_has_platform_role('super_admin'));
CREATE POLICY "members record own media" ON public.media_assets FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (organization_id IS NULL OR public.current_user_is_org_member(organization_id)));
CREATE INDEX media_assets_user_idx ON public.media_assets(user_id, created_at DESC);