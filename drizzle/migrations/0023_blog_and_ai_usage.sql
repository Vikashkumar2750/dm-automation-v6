CREATE TABLE public.blog_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blog_categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.blog_categories TO authenticated;
GRANT ALL ON public.blog_categories TO service_role;
ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read blog categories" ON public.blog_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Super admins manage blog categories" ON public.blog_categories FOR ALL TO authenticated
  USING (public.current_user_has_platform_role('super_admin'))
  WITH CHECK (public.current_user_has_platform_role('super_admin'));

CREATE TABLE public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  excerpt text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  cover_url text,
  cover_alt text,
  category_id uuid REFERENCES public.blog_categories(id) ON DELETE SET NULL,
  tags text[] NOT NULL DEFAULT '{}',
  author_name text NOT NULL DEFAULT 'Techaasvik Team',
  status text NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  seo_title text,
  meta_description text,
  focus_keyword text,
  canonical_url text,
  noindex boolean NOT NULL DEFAULT false,
  faq jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blog_posts_status_valid CHECK (status IN ('draft','scheduled','published')),
  CONSTRAINT blog_posts_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
GRANT SELECT ON public.blog_posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;
GRANT ALL ON public.blog_posts TO service_role;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads published posts" ON public.blog_posts FOR SELECT TO anon, authenticated
  USING (status IN ('published','scheduled') AND published_at IS NOT NULL AND published_at <= now());
CREATE POLICY "Super admins manage posts" ON public.blog_posts FOR ALL TO authenticated
  USING (public.current_user_has_platform_role('super_admin'))
  WITH CHECK (public.current_user_has_platform_role('super_admin'));
CREATE INDEX blog_posts_published_idx ON public.blog_posts (status, published_at DESC);
CREATE TRIGGER blog_posts_updated_at BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.ai_assistant_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  feature text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_assistant_usage TO authenticated;
GRANT ALL ON public.ai_assistant_usage TO service_role;
ALTER TABLE public.ai_assistant_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own AI usage" ON public.ai_assistant_usage FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE INDEX ai_assistant_usage_user_day_idx ON public.ai_assistant_usage (user_id, created_at DESC);

INSERT INTO public.blog_categories (slug, name, description) VALUES
  ('instagram-automation', 'Instagram Automation', 'Comment-to-DM, auto replies and follow gates for Instagram.'),
  ('facebook-automation', 'Facebook Automation', 'Facebook Page comment replies and Messenger automation.'),
  ('youtube', 'YouTube', 'YouTube comment replies and publishing.'),
  ('guides', 'Guides', 'Step-by-step guides for creators and businesses in India.');