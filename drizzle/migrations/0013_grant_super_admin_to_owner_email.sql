delete from public.platform_roles
where user_id in (select id from auth.users where email like '%@techaasvik-test.com');

insert into public.platform_roles (user_id, role)
select id, 'super_admin'::platform_role from auth.users
where email = 'gkrishnaa61@gmail.com'
on conflict do nothing;