insert into public.platform_roles (user_id, role)
select u.id, 'super_admin'::platform_role
from auth.users u
where lower(u.email) = 'contact@techaavik.com'
on conflict do nothing;

insert into public.profiles (id, full_name, email)
select u.id, 'Techaasvik Admin', u.email
from auth.users u
where lower(u.email) = 'contact@techaavik.com'
on conflict (id) do nothing;