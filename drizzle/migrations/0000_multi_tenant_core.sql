-- Enums
create type public.org_role as enum ('owner','admin','manager','agent','viewer');
create type public.platform_role as enum ('super_admin','support');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- Organizations (tenants / workspaces)
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan text not null default 'starter',
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.organizations to authenticated;
grant all on public.organizations to service_role;
alter table public.organizations enable row level security;

-- Memberships
create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.org_role not null default 'viewer',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members(user_id);
grant select, insert, update, delete on public.organization_members to authenticated;
grant all on public.organization_members to service_role;
alter table public.organization_members enable row level security;

-- Platform-level roles (super admin)
create table public.platform_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.platform_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.platform_roles to authenticated;
grant all on public.platform_roles to service_role;
alter table public.platform_roles enable row level security;

-- Security definer helpers (avoid RLS recursion)
create or replace function public.has_platform_role(_user_id uuid, _role public.platform_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_org_member(_org_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members where organization_id = _org_id and user_id = _user_id)
$$;

create or replace function public.has_org_role(_org_id uuid, _user_id uuid, _roles public.org_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = _org_id and user_id = _user_id and role = any(_roles)
  )
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger organizations_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();

-- Policies: profiles
create policy "profiles select own" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_platform_role(auth.uid(), 'super_admin'));
create policy "profiles insert own" on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy "profiles update own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Policies: organizations
create policy "orgs select member" on public.organizations for select to authenticated
  using (public.is_org_member(id, auth.uid()) or public.has_platform_role(auth.uid(), 'super_admin'));
create policy "orgs insert own" on public.organizations for insert to authenticated
  with check (owner_id = auth.uid());
create policy "orgs update admin" on public.organizations for update to authenticated
  using (public.has_org_role(id, auth.uid(), array['owner','admin']::public.org_role[]))
  with check (public.has_org_role(id, auth.uid(), array['owner','admin']::public.org_role[]));
create policy "orgs delete owner" on public.organizations for delete to authenticated
  using (owner_id = auth.uid());

-- Policies: organization_members
create policy "members select same org" on public.organization_members for select to authenticated
  using (user_id = auth.uid() or public.is_org_member(organization_id, auth.uid())
         or public.has_platform_role(auth.uid(), 'super_admin'));
create policy "members insert admin or self-bootstrap" on public.organization_members for insert to authenticated
  with check (
    public.has_org_role(organization_id, auth.uid(), array['owner','admin']::public.org_role[])
    or exists (select 1 from public.organizations o where o.id = organization_id and o.owner_id = auth.uid())
  );
create policy "members update admin" on public.organization_members for update to authenticated
  using (public.has_org_role(organization_id, auth.uid(), array['owner','admin']::public.org_role[]))
  with check (public.has_org_role(organization_id, auth.uid(), array['owner','admin']::public.org_role[]));
create policy "members delete admin" on public.organization_members for delete to authenticated
  using (public.has_org_role(organization_id, auth.uid(), array['owner','admin']::public.org_role[])
         or user_id = auth.uid());

-- Policies: platform_roles
create policy "platform roles select own" on public.platform_roles for select to authenticated
  using (user_id = auth.uid() or public.has_platform_role(auth.uid(), 'super_admin'));
