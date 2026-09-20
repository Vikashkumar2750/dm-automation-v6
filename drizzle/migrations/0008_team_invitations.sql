-- Teammate profile visibility within a shared organization
create or replace function public.shares_org(_a uuid, _b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m1
    join public.organization_members m2
      on m1.organization_id = m2.organization_id
    where m1.user_id = _a and m2.user_id = _b
  )
$$;

create policy "profiles select teammates" on public.profiles for select to authenticated
  using (public.shares_org(auth.uid(), id));

-- Invitations
create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role org_role not null default 'agent',
  token text not null unique,
  invited_by uuid references auth.users(id),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now()
);

create unique index organization_invitations_pending_idx
  on public.organization_invitations (organization_id, lower(email))
  where accepted_at is null;

grant select, insert, update, delete on public.organization_invitations to authenticated;
grant all on public.organization_invitations to service_role;

alter table public.organization_invitations enable row level security;

create policy "invites select members" on public.organization_invitations for select to authenticated
  using (public.is_org_member(organization_id, auth.uid()) or public.has_platform_role(auth.uid(), 'super_admin'));

create policy "invites insert managers" on public.organization_invitations for insert to authenticated
  with check (public.has_org_role(organization_id, auth.uid(), array['owner','admin']::org_role[]));

create policy "invites update managers" on public.organization_invitations for update to authenticated
  using (public.has_org_role(organization_id, auth.uid(), array['owner','admin']::org_role[]));

create policy "invites delete managers" on public.organization_invitations for delete to authenticated
  using (public.has_org_role(organization_id, auth.uid(), array['owner','admin']::org_role[]));
