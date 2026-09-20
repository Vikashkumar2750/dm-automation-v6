delete from public.platform_roles
where user_id in (select id from auth.users where email like '%@techaasvik-test.com');

insert into public.platform_roles (user_id, role)
select o.owner_id, 'super_admin'::platform_role
from public.organizations o
order by o.created_at asc
limit 1
on conflict do nothing;