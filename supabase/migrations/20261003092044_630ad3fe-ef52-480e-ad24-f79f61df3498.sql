insert into public.platform_settings (id, feature_flags)
values (true, '{"flows_enabled":true,"flows_orgs":[],"flows_live_enabled":true,"flows_live_orgs":[],"entry_points_enabled":true,"entry_points_orgs":[],"ai_agent_enabled":true,"ai_agent_orgs":[]}'::jsonb)
on conflict (id) do nothing;