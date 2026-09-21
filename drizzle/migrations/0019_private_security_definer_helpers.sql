create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated, service_role;

alter function public.has_org_role(uuid, uuid, public.org_role[]) set schema app_private;
alter function public.has_platform_role(uuid, public.platform_role) set schema app_private;
alter function public.is_org_member(uuid, uuid) set schema app_private;
alter function public.shares_org(uuid, uuid) set schema app_private;

create or replace function public.current_user_has_org_role(_org_id uuid, _roles public.org_role[])
returns boolean
language sql
stable
security invoker
set search_path to 'public'
as $$
  select app_private.has_org_role(_org_id, auth.uid(), _roles)
$$;

create or replace function public.current_user_is_org_member(_org_id uuid)
returns boolean
language sql
stable
security invoker
set search_path to 'public'
as $$
  select app_private.is_org_member(_org_id, auth.uid())
$$;

create or replace function public.current_user_has_platform_role(_role public.platform_role)
returns boolean
language sql
stable
security invoker
set search_path to 'public'
as $$
  select app_private.has_platform_role(auth.uid(), _role)
$$;

revoke all on function public.current_user_has_org_role(uuid, public.org_role[]) from public, anon;
revoke all on function public.current_user_is_org_member(uuid) from public, anon;
revoke all on function public.current_user_has_platform_role(public.platform_role) from public, anon;

grant execute on function public.current_user_has_org_role(uuid, public.org_role[]) to authenticated, service_role;
grant execute on function public.current_user_is_org_member(uuid) to authenticated, service_role;
grant execute on function public.current_user_has_platform_role(public.platform_role) to authenticated, service_role;