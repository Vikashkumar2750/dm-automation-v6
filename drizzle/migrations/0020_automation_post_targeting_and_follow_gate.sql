-- Post targeting, comment+DM combo, attachments/links and follow gating for automations.

alter table public.automation_rules
  add column if not exists target_post_ids text[] not null default '{}',
  add column if not exists comment_reply_text text,
  add column if not exists comment_reply_variations text[] not null default '{}',
  add column if not exists dm_link_url text,
  add column if not exists dm_button_label text,
  add column if not exists dm_attachment_url text,
  add column if not exists dm_attachment_type text not null default 'none',
  add column if not exists follower_condition text not null default 'any',
  add column if not exists require_follow boolean not null default false,
  add column if not exists follow_prompt_text text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'automation_rules_follower_condition_check') then
    alter table public.automation_rules
      add constraint automation_rules_follower_condition_check
      check (follower_condition in ('any', 'followers_only', 'non_followers'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'automation_rules_dm_attachment_type_check') then
    alter table public.automation_rules
      add constraint automation_rules_dm_attachment_type_check
      check (dm_attachment_type in ('none', 'image', 'video', 'file'));
  end if;
end $$;

create table if not exists public.automation_follow_gates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_id uuid references public.automation_rules(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  social_account_id uuid references public.social_accounts(id) on delete set null,
  platform social_platform not null,
  external_user_id text not null,
  comment_external_id text,
  status text not null default 'waiting',
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  last_checked_at timestamptz,
  completed_at timestamptz
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'automation_follow_gates_status_check') then
    alter table public.automation_follow_gates
      add constraint automation_follow_gates_status_check
      check (status in ('waiting', 'completed', 'expired'));
  end if;
end $$;

create index if not exists automation_follow_gates_lookup
  on public.automation_follow_gates (organization_id, platform, external_user_id, status);

grant select on public.automation_follow_gates to authenticated;
grant all on public.automation_follow_gates to service_role;

alter table public.automation_follow_gates enable row level security;

drop policy if exists "members read follow gates" on public.automation_follow_gates;
create policy "members read follow gates"
  on public.automation_follow_gates
  for select
  to authenticated
  using (public.current_user_is_org_member(organization_id));
