-- Blog CMS + per-user daily AI limit (idempotent, safe to re-run)
create table if not exists public.blog_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text not null default '',
  content text not null default '',
  cover_url text,
  cover_alt text,
  category_id uuid references public.blog_categories(id) on delete set null,
  tags text[] not null default '{}',
  author_name text not null default 'Techaasvik Team',
  status text not null default 'draft',
  published_at timestamptz,
  seo_title text,
  meta_description text,
  focus_keyword text,
  canonical_url text,
  noindex boolean not null default false,
  faq jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.blog_categories, public.blog_posts to anon, authenticated;
grant all on public.blog_categories, public.blog_posts to service_role;
alter table public.blog_categories enable row level security;
alter table public.blog_posts enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='blog_posts' and policyname='Published posts are public') then
    create policy "Published posts are public" on public.blog_posts for select to anon, authenticated using (status = 'published');
  end if;
  if not exists (select 1 from pg_policies where tablename='blog_categories' and policyname='Categories are public') then
    create policy "Categories are public" on public.blog_categories for select to anon, authenticated using (true);
  end if;
end $$;
drop trigger if exists blog_posts_updated_at on public.blog_posts;
create trigger blog_posts_updated_at before update on public.blog_posts for each row execute function public.set_updated_at();

create table if not exists public.ai_usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  requests integer not null default 0,
  primary key (user_id, day)
);
grant all on public.ai_usage_daily to service_role;
alter table public.ai_usage_daily enable row level security;

create or replace function public.consume_ai_request(_user_id uuid, _limit integer)
returns integer language plpgsql security definer set search_path = public as $$
declare used integer;
begin
  insert into public.ai_usage_daily (user_id, day, requests) values (_user_id, current_date, 1)
  on conflict (user_id, day) do update set requests = ai_usage_daily.requests + 1
  where ai_usage_daily.requests < _limit
  returning requests into used;
  return coalesce(used, -1);
end $$;
revoke all on function public.consume_ai_request(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_ai_request(uuid, integer) to service_role;
insert into public.blog_posts (slug, title, focus_keyword, excerpt, meta_description, seo_title, status, tags, faq, content) values
('instagram-comment-to-dm-automation-guide', 'Instagram Comment to DM Automation: Complete Guide', 'instagram comment to dm automation',
 'How to automatically send a DM when someone comments a keyword on your Instagram post or reel, safely and within Meta rules.',
 'Learn Instagram comment to DM automation step by step: keyword triggers, follow gates, safe limits and how AutoDM turns comments into leads.',
 'Instagram Comment to DM Automation: Complete Guide', 'published', array['instagram','automation'],
 '[{"q":"Is Instagram comment to DM automation allowed?","a":"Yes, when it uses the official Meta API and replies only to people who commented, as AutoDM does."},{"q":"Do I need a professional account?","a":"Yes, a Business or Creator Instagram account linked to a Facebook Page is required."},{"q":"How fast is the DM sent?","a":"Usually within a few seconds of the comment."}]'::jsonb,
 E'Instagram comment to DM automation is a way to send a private message automatically when someone comments a chosen keyword on your post or reel. It saves hours of manual replies and turns comments into leads.\n\n## What is Instagram comment to DM automation?\n\nIt refers to a rule that watches comments and replies in DM using the official Meta API.\n\n## How to set it up with AutoDM\n\n1. Connect your Instagram professional account.\n2. Create a new comment rule and pick a keyword like "price".\n3. Write the DM and an optional public reply.\n4. Turn the rule on.\n\n## Best practices\n\n- Keep keywords short and clear.\n- Add 2-3 reply variations.\n- Respect daily limits.\n\nRead the official [Instagram Messaging docs](https://developers.facebook.com/docs/instagram-platform). Ready to start? [Create your free AutoDM account](/auth).'),
('facebook-page-auto-reply-messenger', 'Facebook Page Auto Reply: Reply to Comments and Messenger Automatically', 'facebook auto reply',
 'Set up Facebook auto reply for Page comments and Messenger so no customer waits for an answer.',
 'Facebook auto reply guide: automatically answer Page comments and Messenger messages with keyword rules using AutoDM by Techaasvik.',
 'Facebook Page Auto Reply for Comments and Messenger', 'published', array['facebook','messenger'],
 '[{"q":"Can I auto reply to Facebook comments?","a":"Yes, AutoDM can post a public reply and send a private message to the commenter."},{"q":"Does it work for ads?","a":"Comments on boosted posts linked to your Page are supported."},{"q":"Is it free to try?","a":"Yes, you can start on the free plan."}]'::jsonb,
 E'Facebook auto reply means your Page answers comments and Messenger messages automatically using rules you set. It keeps response times low and captures leads 24/7.\n\n## Why use Facebook auto reply\n\n- Faster replies improve trust.\n- Every comment becomes a conversation.\n\n## Setting it up\n\n1. Connect your Facebook Page in AutoDM.\n2. Create a comment rule with your keyword.\n3. Choose public reply, private DM, or both.\n\nSee Meta''s [Messenger Platform docs](https://developers.facebook.com/docs/messenger-platform). [Start with AutoDM](/auth).'),
('youtube-comment-reply-automation', 'YouTube Comment Reply Automation with AI', 'youtube comment reply automation',
 'Reply to YouTube comments automatically with natural AI replies that understand each comment.',
 'YouTube comment reply automation with AI: natural, relevant replies, per-viewer cooldowns and a unified inbox in AutoDM by Techaasvik.',
 'YouTube Comment Reply Automation with AI', 'published', array['youtube','ai'],
 '[{"q":"Can YouTube replies be automated?","a":"Yes, public comment replies can be automated through the YouTube Data API."},{"q":"Does YouTube support DMs?","a":"No, YouTube has no direct messages, so only public replies are possible."},{"q":"Will replies look spammy?","a":"AutoDM reads each comment and limits repeat replies per viewer."}]'::jsonb,
 E'YouTube comment reply automation is a way to answer viewer comments automatically with relevant, human-sounding replies. AutoDM reads each comment with AI and replies in the same language.\n\n## How it works\n\n- New comments are checked every few minutes.\n- AI writes a short reply related to the comment.\n- Cooldowns stop repeat replies to the same viewer.\n\n## Set it up\n\n1. Connect your YouTube channel.\n2. Create a YouTube rule (public reply only).\n3. Pick videos or all videos.\n\nRead the [YouTube Data API docs](https://developers.google.com/youtube/v3). [Try AutoDM](/auth).')
on conflict (slug) do nothing;
update public.blog_posts set published_at = coalesce(published_at, now()) where status = 'published';
