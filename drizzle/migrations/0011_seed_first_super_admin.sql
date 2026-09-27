insert into public.platform_roles (user_id, role)
select u.id, 'super_admin'::platform_role
from auth.users u
order by u.created_at asc
limit 1
on conflict do nothing;