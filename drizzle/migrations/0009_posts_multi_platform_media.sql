ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS media_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS post_format text NOT NULL DEFAULT 'feed',
  ADD COLUMN IF NOT EXISTS group_id uuid;

UPDATE public.posts
SET media_urls = ARRAY[media_url]
WHERE media_url IS NOT NULL AND cardinality(media_urls) = 0;

CREATE INDEX IF NOT EXISTS posts_group_id_idx ON public.posts (group_id);