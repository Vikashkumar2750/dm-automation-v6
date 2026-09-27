create type public.automation_trigger as enum ('dm_received','comment_received');
create type public.automation_match as enum ('any','contains','exact','starts_with');
create type public.automation_action as enum ('reply_dm','comment_public_reply','comment_private_reply','hide_comment','set_status');
create type public.automation_run_status as enum ('matched','sent','skipped','failed');

create table public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  priority integer not null default 100,
  platform social_platform,
  trigger automation_trigger not null,
  match_type automation_match not null default 'contains',
  keywords text[] not null default '{}'::text[],
  action automation_action not null,
  response_text text,
  set_status conversation_status,
  cooldown_seconds integer not null default 60,
  daily_limit integer not null default 200,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index automation_rules_org_idx on public.automation_rules (organization_id, is_active, priority);

grant select, insert, update, delete on public.automation_rules to authenticated;
grant all on public.automation_rules to service_role;
alter table public.automation_rules enable row level security;

create policy "automation rules select member" on public.automation_rules
  for select to authenticated
  using (is_org_member(organization_id, auth.uid()) or has_platform_role(auth.uid(),'super_admin'));
create policy "automation rules insert manager" on public.automation_rules
  for insert to authenticated
  with check (has_org_role(organization_id, auth.uid(), array['owner','admin','manager']::org_role[]));
create policy "automation rules update manager" on public.automation_rules
  for update to authenticated
  using (has_org_role(organization_id, auth.uid(), array['owner','admin','manager']::org_role[]))
  with check (has_org_role(organization_id, auth.uid(), array['owner','admin','manager']::org_role[]));
create policy "automation rules delete admin" on public.automation_rules
  for delete to authenticated
  using (has_org_role(organization_id, auth.uid(), array['owner','admin']::org_role[]));

create trigger automation_rules_updated_at before update on public.automation_rules
  for each row execute function public.set_updated_at();

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_id uuid references public.automation_rules(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete cascade,
  message_id uuid,
  status automation_run_status not null default 'matched',
  detail text,
  created_at timestamptz not null default now()
);

create index automation_runs_org_idx on public.automation_runs (organization_id, created_at desc);
create index automation_runs_rule_day_idx on public.automation_runs (rule_id, created_at desc);

grant select on public.automation_runs to authenticated;
grant all on public.automation_runs to service_role;
alter table public.automation_runs enable row level security;

create policy "automation runs select member" on public.automation_runs
  for select to authenticated
  using (is_org_member(organization_id, auth.uid()) or has_platform_role(auth.uid(),'super_admin'));
create policy "automation runs service role" on public.automation_runs
  for all to service_role using (true) with check (true);