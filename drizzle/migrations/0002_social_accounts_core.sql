create type public.social_platform as enum ('instagram','facebook','youtube');
create type public.social_account_status as enum ('connected','attention','disconnected');

create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  platform public.social_platform not null,
  external_id text not null,
  name text not null,
  handle text,
  avatar_url text,
  status public.social_account_status not null default 'connected',
  scopes text[] not null default '{}',
  capabilities jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  token_expires_at timestamptz,
  last_synced_at timestamptz,
  connected_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, platform, external_id)
);

grant select, insert, update, delete on public.social_accounts to authenticated;
grant all on public.social_accounts to service_role;
alter table public.social_accounts enable row level security;

create policy "social accounts select member" on public.social_accounts for select to authenticated
  using (public.is_org_member(organization_id, auth.uid()) or public.has_platform_role(auth.uid(), 'super_admin'));
create policy "social accounts insert manager" on public.social_accounts for insert to authenticated
  with check (public.has_org_role(organization_id, auth.uid(), array['owner','admin','manager']::org_role[]));
create policy "social accounts update manager" on public.social_accounts for update to authenticated
  using (public.has_org_role(organization_id, auth.uid(), array['owner','admin','manager']::org_role[]))
  with check (public.has_org_role(organization_id, auth.uid(), array['owner','admin','manager']::org_role[]));
create policy "social accounts delete admin" on public.social_accounts for delete to authenticated
  using (public.has_org_role(organization_id, auth.uid(), array['owner','admin']::org_role[]));

create trigger social_accounts_updated_at before update on public.social_accounts
  for each row execute function public.set_updated_at();

-- Tokens are never readable by the client: service_role only.
create table public.social_account_tokens (
  social_account_id uuid primary key references public.social_accounts(id) on delete cascade,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant all on public.social_account_tokens to service_role;
alter table public.social_account_tokens enable row level security;

create trigger social_account_tokens_updated_at before update on public.social_account_tokens
  for each row execute function public.set_updated_at();

-- Short-lived OAuth state, service_role only.
create table public.oauth_states (
  state text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform public.social_platform not null,
  redirect_path text not null default '/social-accounts',
  code_verifier text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes'
);
grant all on public.oauth_states to service_role;
alter table public.oauth_states enable row level security;